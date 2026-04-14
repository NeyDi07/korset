-- =============================================================
-- Körset — Retail Analytics RPC Functions (Phase 1)
-- Run in: Supabase Dashboard → SQL Editor → New query
-- =============================================================

-- 1. Топ-N сканируемых товаров за N дней
CREATE OR REPLACE FUNCTION get_top_scanned_products(
  p_store_id uuid,
  p_days_back int DEFAULT 30,
  p_limit int DEFAULT 5
)
RETURNS TABLE(ean text, scan_count bigint, name text, image_url text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    se.ean,
    COUNT(se.id) AS scan_count,
    gp.name,
    gp.image_url
  FROM scan_events se
  LEFT JOIN global_products gp ON gp.ean = se.ean
  WHERE se.store_id = p_store_id
    AND se.scanned_at >= NOW() - (p_days_back || ' days')::interval
  GROUP BY se.ean, gp.name, gp.image_url
  ORDER BY scan_count DESC
  LIMIT p_limit;
$$;

-- 2. Упущенная выгода — товары, которые сканировали, но их нет или они кончились
CREATE OR REPLACE FUNCTION get_missed_opportunities(
  p_store_id uuid,
  p_days_back int DEFAULT 30
)
RETURNS TABLE(ean text, scan_count bigint, name text, image_url text, reason text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    se.ean,
    COUNT(se.id) AS scan_count,
    gp.name,
    gp.image_url,
    CASE
      WHEN sp.id IS NULL THEN 'not_in_catalog'
      ELSE 'out_of_stock'
    END AS reason
  FROM scan_events se
  LEFT JOIN global_products gp ON gp.ean = se.ean
  LEFT JOIN store_products sp
    ON sp.store_id = p_store_id
    AND sp.ean = se.ean
    AND sp.is_active = true
  WHERE se.store_id = p_store_id
    AND se.scanned_at >= NOW() - (p_days_back || ' days')::interval
    AND (sp.id IS NULL OR sp.stock_status = 'out_of_stock')
  GROUP BY se.ean, gp.name, gp.image_url, sp.id, sp.stock_status
  ORDER BY scan_count DESC;
$$;
