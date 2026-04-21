-- Migration 009: Add store profile fields + Dashboard RPC functions + Storage bucket
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Store profile columns
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS twogis_url text,
  ADD COLUMN IF NOT EXISTS website_url text;

-- 2. Storage bucket for store logos (public, max 2MB, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-logos',
  'store-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- RLS: любой аутентифицированный владелец магазина может загружать логотип
-- Проверяем: путь начинается с store_id пользователя
DROP POLICY IF EXISTS "Store owners can upload logo" ON storage.objects;
CREATE POLICY "Store owners can upload logo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'store-logos'
    AND auth.uid() IN (SELECT owner_id FROM public.stores WHERE is_active = true)
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM public.stores WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Store owners can update logo" ON storage.objects;
CREATE POLICY "Store owners can update logo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'store-logos'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM public.stores WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Store owners can delete logo" ON storage.objects;
CREATE POLICY "Store owners can delete logo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'store-logos'
    AND split_part(name, '/', 1) IN (
      SELECT id::text FROM public.stores WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public logo read" ON storage.objects;
CREATE POLICY "Public logo read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'store-logos');

-- 3. RPC: count unique customers (distinct user_id in scan_events)
CREATE OR REPLACE FUNCTION get_unique_customers(p_store_id uuid, p_days_back int)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT user_id)
    FROM scan_events
    WHERE store_id = p_store_id
      AND scanned_at >= NOW() - (p_days_back || ' days')::interval
      AND user_id IS NOT NULL
  );
END;
$$;

-- 4. RPC: lost revenue estimate — scans for items not in catalog OR out of stock × price_kzt
CREATE OR REPLACE FUNCTION get_lost_revenue(p_store_id uuid, p_days_back int)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result numeric;
BEGIN
  SELECT COALESCE(SUM(sp.price_kzt), 0)
  INTO v_result
  FROM scan_events se
  JOIN store_products sp
    ON sp.ean = se.ean
    AND sp.store_id = se.store_id
    AND sp.is_active = true
    AND sp.price_kzt > 0
    AND sp.stock_status = 'out_of_stock'
  WHERE se.store_id = p_store_id
    AND se.scanned_at >= NOW() - (p_days_back || ' days')::interval;

  -- Also add value for items scanned but NOT in catalog at all
  SELECT v_result + COALESCE(
    (SELECT SUM(COALESCE(sp2.price_kzt, 0))
     FROM scan_events se2
     LEFT JOIN store_products sp2
       ON sp2.ean = se2.ean AND sp2.store_id = se2.store_id AND sp2.is_active = true
     WHERE se2.store_id = p_store_id
       AND se2.scanned_at >= NOW() - (p_days_back || ' days')::interval
       AND sp2.id IS NULL),
    0
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 5. RPC: catalog scan coverage — % of scans where item was found in-stock
CREATE OR REPLACE FUNCTION get_scan_coverage(p_store_id uuid, p_days_back int)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total bigint;
  v_found bigint;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM scan_events
  WHERE store_id = p_store_id
    AND scanned_at >= NOW() - (p_days_back || ' days')::interval;

  IF v_total = 0 THEN RETURN 0; END IF;

  SELECT COUNT(se.id) INTO v_found
  FROM scan_events se
  JOIN store_products sp
    ON sp.ean = se.ean
    AND sp.store_id = se.store_id
    AND sp.is_active = true
    AND sp.stock_status != 'out_of_stock'
  WHERE se.store_id = p_store_id
    AND se.scanned_at >= NOW() - (p_days_back || ' days')::interval;

  RETURN ROUND((v_found::numeric / v_total::numeric) * 100, 1);
END;
$$;
