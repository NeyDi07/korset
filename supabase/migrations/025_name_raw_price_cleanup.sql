-- Migration 025: name_raw + price cleanup
-- ══════════════════════════════════════════════════════════════════
-- 1. Preserve original product names before normalization
-- 2. Remove arbuz_price from specs_json (store prices only)
-- 3. Drop dead price columns (unit_type, price_per_unit_kzt)
-- 4. Fix price CHECK: > 0 instead of >= 0
-- 5. Add CHECK on unknown_ean_staging and missing_products
-- ══════════════════════════════════════════════════════════════════

-- 1. Add name_raw column to preserve originals before normalization
ALTER TABLE public.global_products
  ADD COLUMN IF NOT EXISTS name_raw text;

-- Copy current name values to name_raw
UPDATE public.global_products
  SET name_raw = name
  WHERE name_raw IS NULL AND name IS NOT NULL;

-- 2. Remove arbuz_price from specs_json (reference prices not used)
UPDATE public.global_products
  SET specs_json = specs_json - 'arbuz_price'
  WHERE specs_json ? 'arbuz_price';

-- 3. Drop dead price columns (never used by frontend or backend)
ALTER TABLE public.store_products
  DROP COLUMN IF EXISTS unit_type;

ALTER TABLE public.store_products
  DROP COLUMN IF EXISTS price_per_unit_kzt;

-- 4. Fix price CHECK constraint: price_kzt > 0 (0 is not a valid price)
ALTER TABLE public.store_products
  DROP CONSTRAINT IF EXISTS store_products_price_kzt_check;

ALTER TABLE public.store_products
  ADD CONSTRAINT store_products_price_kzt_check
  CHECK (price_kzt IS NULL OR price_kzt > 0);

-- 5. Add CHECK on unknown_ean_staging.price_kzt
ALTER TABLE public.unknown_ean_staging
  DROP CONSTRAINT IF EXISTS unknown_staging_price_check;

ALTER TABLE public.unknown_ean_staging
  ADD CONSTRAINT unknown_staging_price_check
  CHECK (price_kzt IS NULL OR price_kzt > 0);

-- 6. Add CHECK on missing_products.last_import_price_kzt
ALTER TABLE public.missing_products
  DROP CONSTRAINT IF EXISTS missing_products_price_check;

ALTER TABLE public.missing_products
  ADD CONSTRAINT missing_products_price_check
  CHECK (last_import_price_kzt IS NULL OR last_import_price_kzt > 0);

-- 7. Batch name update RPC for normalization backfill
CREATE OR REPLACE FUNCTION public.batch_update_product_names(p_updates jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  u record;
BEGIN
  FOR u IN SELECT * FROM jsonb_array_elements(p_updates) AS x(val)
  LOOP
    UPDATE public.global_products
    SET name = u.val->>'name'
    WHERE id = (u.val->>'id')::uuid
    AND name != u.val->>'name';
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
