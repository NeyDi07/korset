-- Migration 021: Sync users.is_admin → auth.users.raw_app_meta_data.is_admin
--
-- Контекст:
--   src/layouts/RetailLayout.jsx до этого фикса читал admin-флаг из
--     user.user_metadata?.role === 'admin'
--   Это КРИТИЧНАЯ дыра: user_metadata модифицируемо клиентом через
--     supabase.auth.updateUser({ data: { role: 'admin' } })
--   Любой пользователь мог сделать себя admin → доступ ко всему RetailLayout
--   (RetailDashboard / RetailProducts / EanRecovery / RetailSettings).
--
--   Решение: переключить UI-проверку на app_metadata.is_admin, который
--   модифицируется ТОЛЬКО service_role (Supabase Auth gates this hard).
--   Сами админ-операции уже защищены через is_admin_user RPC + RLS на сервере,
--   но user_metadata-проверка пропускала пользователя в админский UI.
--
-- Что делает этот файл:
--   1. Функция sync_admin_to_app_metadata() — обновляет auth.users.raw_app_meta_data.is_admin
--      зеркально с public.users.is_admin
--   2. Триггер на public.users (AFTER UPDATE OF is_admin) — реактивно синхронизирует
--   3. Триггер на public.users (AFTER INSERT) — для новых пользователей
--   4. Backfill для существующих admin-пользователей
--
-- ВАЖНО: app_metadata попадает в JWT, который рефрешится клиентом каждые 60 минут.
-- При смене is_admin пользователю нужно либо подождать (≤60 мин), либо logout/login
-- для немедленного применения. Это приемлемо для редко-меняющегося admin-флага.

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- 1. Функция синхронизации
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_admin_to_app_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- нужно для UPDATE на auth.users (обычные роли не могут)
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Защита: если auth_id NULL (например, гость без аккаунта) — пропускаем
  IF NEW.auth_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{is_admin}',
    to_jsonb(COALESCE(NEW.is_admin, false))
  )
  WHERE id = NEW.auth_id;

  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 2. Триггер на изменение is_admin (UPDATE)
-- ────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS sync_users_admin_to_jwt ON public.users;
CREATE TRIGGER sync_users_admin_to_jwt
  AFTER UPDATE OF is_admin ON public.users
  FOR EACH ROW
  WHEN (NEW.is_admin IS DISTINCT FROM OLD.is_admin)
  EXECUTE FUNCTION public.sync_admin_to_app_metadata();

-- ────────────────────────────────────────────────────────────────
-- 3. Триггер на INSERT (для новых пользователей с is_admin=true сразу)
-- ────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS sync_users_admin_to_jwt_insert ON public.users;
CREATE TRIGGER sync_users_admin_to_jwt_insert
  AFTER INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.is_admin = true AND NEW.auth_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_admin_to_app_metadata();

-- ────────────────────────────────────────────────────────────────
-- 4. Backfill: синхронизация существующих admin-пользователей
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  affected_count integer;
BEGIN
  WITH admin_users AS (
    SELECT u.auth_id, u.is_admin
    FROM public.users u
    WHERE u.auth_id IS NOT NULL
      AND u.is_admin IS NOT NULL
  )
  UPDATE auth.users a
  SET raw_app_meta_data = jsonb_set(
    COALESCE(a.raw_app_meta_data, '{}'::jsonb),
    '{is_admin}',
    to_jsonb(au.is_admin)
  )
  FROM admin_users au
  WHERE a.id = au.auth_id
    AND (
      a.raw_app_meta_data->>'is_admin' IS NULL
      OR (a.raw_app_meta_data->>'is_admin')::boolean IS DISTINCT FROM au.is_admin
    );

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '[021] Backfilled is_admin in app_metadata for % users', affected_count;
END $$;

-- ────────────────────────────────────────────────────────────────
-- Верификация: убедиться что все public.users.is_admin синхронизированы
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  mismatched integer;
BEGIN
  SELECT COUNT(*) INTO mismatched
  FROM public.users u
  JOIN auth.users a ON a.id = u.auth_id
  WHERE u.is_admin IS NOT NULL
    AND COALESCE((a.raw_app_meta_data->>'is_admin')::boolean, false) IS DISTINCT FROM u.is_admin;

  IF mismatched > 0 THEN
    RAISE EXCEPTION '[021] Verification failed: % users have mismatched is_admin', mismatched;
  END IF;

  RAISE NOTICE '[021] Verification OK: all admin flags synchronized';
END $$;

COMMIT;
