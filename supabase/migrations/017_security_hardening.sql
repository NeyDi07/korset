-- ═══════════════════════════════════════════════════════════════════════════
-- 017 — Security Hardening (Этап 1 HARDENING_PLAN)
-- ═══════════════════════════════════════════════════════════════════════════
-- Закрывает 4 критичных дыры безопасности из аудита 2026-04-28:
--   1. Нет admin-роли — api/ean-recovery открыт для любого юзера
--   2. RLS stores_update_owner — владелец сам апит plan/expires_at
--   3. RLS scan_events_insert_anon — анон-спам метрик
--   4. RLS missing_products_insert_anon — спам "упущенных товаров"
--
-- Применять через Supabase SQL Editor от service_role.
-- После применения проверить:
--   1. SELECT is_admin FROM public.users LIMIT 1; — колонка существует
--   2. UPDATE public.users SET is_admin = true WHERE auth_id = '<твой-auth_id>';
--      (вручную выдать себе админство; auth_id берётся из auth.users в Supabase Dashboard)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. ADMIN ROLE
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_admin IS
  'Granted manually via SQL Editor. Cannot be self-modified (RLS users_update_own does not allow column drift — see check below).';

-- Защита: юзер не может сам себе выставить is_admin = true
-- (т.к. users_update_own не имеет WITH CHECK на эту колонку, нужен trigger)
CREATE OR REPLACE FUNCTION public.protect_admin_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'is_admin can only be modified by service_role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_users_admin ON public.users;
CREATE TRIGGER protect_users_admin
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_admin_column();

-- RPC для серверной проверки (используется из api/ean-recovery.js)
CREATE OR REPLACE FUNCTION public.is_admin_user(p_auth_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.users WHERE auth_id = p_auth_id LIMIT 1),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. STORES — защита billing-колонок от self-update
-- ──────────────────────────────────────────────────────────────────────────
-- Раньше: владелец магазина мог UPDATE stores SET plan='enterprise'
-- Теперь: plan/expires_at/is_active меняет только service_role

CREATE OR REPLACE FUNCTION public.protect_stores_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
    THEN
      RAISE EXCEPTION 'stores.plan/expires_at/is_active can only be modified by service_role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_stores_billing_trigger ON public.stores;
CREATE TRIGGER protect_stores_billing_trigger
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.protect_stores_billing();

-- ──────────────────────────────────────────────────────────────────────────
-- 3. SCAN_EVENTS — anti-spam через client_token + EAN валидацию
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.scan_events
  ADD COLUMN IF NOT EXISTS client_token uuid;

CREATE INDEX IF NOT EXISTS idx_scan_events_client_token
  ON public.scan_events (client_token, scanned_at DESC)
  WHERE client_token IS NOT NULL;

COMMENT ON COLUMN public.scan_events.client_token IS
  'Per-device random UUID, persisted in localStorage. Required for anon inserts (anti-spam). Migration 017.';

-- Старая policy: WITH CHECK (user_id IS NULL) — спам открыт.
-- Новая: требует client_token + валидный EAN.
DROP POLICY IF EXISTS "scan_events_insert_anon" ON public.scan_events;

CREATE POLICY "scan_events_insert_anon_safe" ON public.scan_events
  FOR INSERT TO anon
  WITH CHECK (
    user_id IS NULL
    AND client_token IS NOT NULL
    AND ean ~ '^\d{8,14}$'
  );

-- Authenticated тоже должен иметь client_token (для дедупа на client side)
-- Но не enforce строго — старые сканы без token'а не блокируем.

-- ──────────────────────────────────────────────────────────────────────────
-- 4. MISSING_PRODUCTS — то же anti-spam
-- ──────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "missing_products_insert_anon" ON public.missing_products;

CREATE POLICY "missing_products_insert_anon_safe" ON public.missing_products
  FOR INSERT TO anon
  WITH CHECK (
    store_id IS NOT NULL
    AND ean ~ '^\d{8,14}$'
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 5. AUDIT-LOG для критичных таблиц (минимальная версия)
-- ──────────────────────────────────────────────────────────────────────────
-- Полноценный audit log в Этапе 2. Здесь — только для stores (биллинг).

CREATE TABLE IF NOT EXISTS public.stores_audit (
  id bigserial PRIMARY KEY,
  store_id uuid NOT NULL,
  op text NOT NULL CHECK (op IN ('UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,  -- auth.uid()
  changed_role text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stores_audit_store_id
  ON public.stores_audit (store_id, changed_at DESC);

ALTER TABLE public.stores_audit ENABLE ROW LEVEL SECURITY;
-- Read только service_role (no policy = deny all for non-service_role)

CREATE OR REPLACE FUNCTION public.audit_stores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.stores_audit (store_id, op, old_data, new_data, changed_by, changed_role)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) END,
    auth.uid(),
    auth.role()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_stores_trigger ON public.stores;
CREATE TRIGGER audit_stores_trigger
  AFTER UPDATE OR DELETE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.audit_stores();

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- ПОСЛЕ APPLY: не забудь выдать себе админство:
--
--   UPDATE public.users SET is_admin = true
--   WHERE auth_id = '<твой-auth_id-из-auth.users>';
--
-- Найти свой auth_id можно в Supabase Dashboard → Authentication → Users
-- (колонка "User UID"), или через:
--   SELECT id, email FROM auth.users WHERE email = 'твой-email';
-- ═══════════════════════════════════════════════════════════════════════════
