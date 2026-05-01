-- Migration 024: Attribute extraction — packaging_type, fat_percent columns
-- ══════════════════════════════════════════════════════════════════
-- Extracts structured data from product names:
--   packaging_type — packaging format (ПЭТ, Тетра-пак, жестебанка, etc.)
--   fat_percent    — fat content percentage for dairy/meat/etc.
-- diet_tags_json and halal_status are updated in-place (columns already exist)
-- ══════════════════════════════════════════════════════════════════

-- 1. Add packaging_type column
ALTER TABLE public.global_products
  ADD COLUMN IF NOT EXISTS packaging_type text
  CHECK (packaging_type IS NULL OR packaging_type IN (
    'bottle_plastic', 'bottle_glass', 'can', 'tetrapak', 'pouch', 'tub'
  ));

-- 2. Add fat_percent column
ALTER TABLE public.global_products
  ADD COLUMN IF NOT EXISTS fat_percent numeric(4,1)
  CHECK (fat_percent IS NULL OR (fat_percent >= 0 AND fat_percent <= 100));

-- 3. Index for filtering by packaging type
CREATE INDEX IF NOT EXISTS idx_global_products_packaging_type
  ON public.global_products (packaging_type)
  WHERE packaging_type IS NOT NULL;

-- 4. Index for fat-based queries (dairy category mostly)
CREATE INDEX IF NOT EXISTS idx_global_products_fat_percent
  ON public.global_products (fat_percent)
  WHERE fat_percent IS NOT NULL;

-- 5. Update data_quality_score function to reward extracted attributes
CREATE OR REPLACE FUNCTION public.calc_data_quality_score(p_row public.global_products)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_score integer;
BEGIN
  CASE p_row.source_primary
    WHEN 'store_import' THEN v_score := 100;
    WHEN 'kz_verified'  THEN v_score := 80;
    WHEN 'npc'          THEN v_score := 75;
    WHEN 'arbuz'        THEN v_score := 75;
    WHEN 'korzinavdom'  THEN v_score := 75;
    WHEN 'kaspi'        THEN v_score := 70;
    WHEN 'halal_damu'   THEN v_score := 70;
    WHEN 'eandb'        THEN v_score := 60;
    WHEN 'openfoodfacts'THEN v_score := 50;
    WHEN 'ai_enriched'  THEN v_score := 20;
    WHEN 'manual'       THEN v_score := 90;
    ELSE v_score := 30;
  END CASE;

  IF p_row.ingredients_raw IS NOT NULL AND length(p_row.ingredients_raw) > 3 THEN
    v_score := least(v_score + 10, 100);
  END IF;

  IF p_row.halal_status IS NOT NULL AND p_row.halal_status != 'unknown' THEN
    v_score := least(v_score + 10, 100);
  END IF;

  IF p_row.image_url IS NOT NULL AND length(p_row.image_url) > 5 THEN
    v_score := least(v_score + 5, 100);
  END IF;

  IF p_row.nutriments_json IS NOT NULL
     AND p_row.nutriments_json != '{}'::jsonb
     AND p_row.nutriments_json != '[]'::jsonb THEN
    v_score := least(v_score + 5, 100);
  END IF;

  IF p_row.packaging_type IS NOT NULL THEN
    v_score := least(v_score + 3, 100);
  END IF;

  IF p_row.fat_percent IS NOT NULL THEN
    v_score := least(v_score + 3, 100);
  END IF;

  RETURN v_score;
END;
$$;
