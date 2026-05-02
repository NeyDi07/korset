-- ═══════════════════════════════════════════════════════════════════════════════
-- 026 — fn_resolve_product_by_ean (Сессия 1: оптимизация сканирования)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Заменяет 2-4 последовательных Supabase-запроса одним RPC round-trip:
--   1. store_products JOIN global_products (с фильтром по store_id + ean/alternate_eans)
--   2. global_products напрямую (fallback без store_id)
--
-- Возвращает JSONB: все поля global_products + overlay _sp_* от store_products.
-- Вызывается из resolver.js → findProductViaRPC().
--
-- Применять через Supabase SQL Editor от service_role.
-- Идемпотентен (CREATE OR REPLACE).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- Основная RPC-функция резолвера
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_resolve_product_by_ean(
  p_ean      TEXT,
  p_store_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- ── 1. Store-context lookup (если передан store_id) ──────────────────────────
  -- Один JOIN: store_products + global_products
  -- Покрывает: gp.ean = p_ean, sp.ean = p_ean, gp.alternate_eans @> [p_ean]
  -- Порядок приоритета ищет точный EAN-матч первым (CASE в ORDER BY)
  IF p_store_id IS NOT NULL THEN
    SELECT
      to_jsonb(gp) || jsonb_build_object(
        '_sp_id',             sp.id,
        '_sp_price_kzt',      sp.price_kzt,
        '_sp_shelf_zone',     sp.shelf_zone,
        '_sp_shelf_position', sp.shelf_position,
        '_sp_stock_status',   sp.stock_status
      )
    INTO v_result
    FROM store_products sp
    JOIN global_products gp ON gp.id = sp.global_product_id
    WHERE sp.store_id  = p_store_id
      AND sp.is_active = TRUE
      AND gp.is_active = TRUE
      AND (
        gp.ean = p_ean
        OR sp.ean = p_ean
        OR gp.alternate_eans @> ARRAY[p_ean]::text[]
      )
    ORDER BY
      CASE
        WHEN gp.ean = p_ean THEN 0
        WHEN sp.ean = p_ean THEN 1
        ELSE 2
      END
    LIMIT 1;

    IF v_result IS NOT NULL THEN
      RETURN v_result;
    END IF;
  END IF;

  -- ── 2. Global catalog lookup (без привязки к магазину) ───────────────────────
  SELECT to_jsonb(gp)
  INTO v_result
  FROM global_products gp
  WHERE gp.is_active = TRUE
    AND (
      gp.ean = p_ean
      OR gp.alternate_eans @> ARRAY[p_ean]::text[]
    )
  ORDER BY
    CASE WHEN gp.ean = p_ean THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN v_result;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- Права доступа: анонимные и аутентифицированные пользователи
-- ──────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fn_resolve_product_by_ean(TEXT, UUID)
  TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- Проверочный запрос (раскомментировать при ручном тестировании):
-- SELECT fn_resolve_product_by_ean('4600680010360', NULL);
-- SELECT fn_resolve_product_by_ean('4600680010360', '<your-store-uuid>');
-- ──────────────────────────────────────────────────────────────────────────────

COMMIT;
