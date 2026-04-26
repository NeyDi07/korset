-- Migration 014: GIN indexes + tsvector full-text search
-- ══════════════════════════════════════════════════════════════
-- Missing GIN on jsonb columns + tsvector for fast text search
-- Currently catalog search uses ilike = full table scan
-- ══════════════════════════════════════════════════════════════

-- GIN on remaining jsonb columns
CREATE INDEX IF NOT EXISTS idx_global_products_specs_gin
  ON public.global_products USING gin (specs_json)
  WHERE specs_json IS NOT NULL AND specs_json != '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_scan_events_fit_reasons_gin
  ON public.scan_events USING gin (fit_reasons_json)
  WHERE fit_reasons_json IS NOT NULL AND fit_reasons_json != '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_external_cache_allergens_gin
  ON public.external_product_cache USING gin (normalized_allergens_json)
  WHERE normalized_allergens_json IS NOT NULL AND normalized_allergens_json != '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_external_cache_diet_tags_gin
  ON public.external_product_cache USING gin (normalized_diet_tags_json)
  WHERE normalized_diet_tags_json IS NOT NULL AND normalized_diet_tags_json != '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_external_cache_nutriments_gin
  ON public.external_product_cache USING gin (normalized_nutriments_json)
  WHERE normalized_nutriments_json IS NOT NULL AND normalized_nutriments_json != '{}'::jsonb;

-- ══════════════════════════════════════════════════════════════
-- tsvector columns for full-text search (RU + EN)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.global_products
  ADD COLUMN IF NOT EXISTS name_tsvector tsvector;

ALTER TABLE public.global_products
  ADD COLUMN IF NOT EXISTS brand_tsvector tsvector;

ALTER TABLE public.global_products
  ADD COLUMN IF NOT EXISTS ingredients_tsvector tsvector;

-- Populate tsvector from existing data
UPDATE public.global_products
SET name_tsvector =
      setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(name_kz, '')), 'B'),
    brand_tsvector =
      to_tsvector('simple', coalesce(brand, '')),
    ingredients_tsvector =
      to_tsvector('simple', coalesce(ingredients_raw, ''))
WHERE name_tsvector IS NULL;

-- GIN on tsvector
CREATE INDEX IF NOT EXISTS idx_global_products_name_tsvector
  ON public.global_products USING gin (name_tsvector);

CREATE INDEX IF NOT EXISTS idx_global_products_brand_tsvector
  ON public.global_products USING gin (brand_tsvector);

CREATE INDEX IF NOT EXISTS idx_global_products_ingredients_tsvector
  ON public.global_products USING gin (ingredients_tsvector);

-- Trigger: auto-update tsvector on insert/update
CREATE OR REPLACE FUNCTION public.update_product_tsvector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name_tsvector :=
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.name_kz, '')), 'B');
  NEW.brand_tsvector :=
    to_tsvector('simple', coalesce(NEW.brand, ''));
  NEW.ingredients_tsvector :=
    to_tsvector('simple', coalesce(NEW.ingredients_raw, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_product_tsvector ON public.global_products;
CREATE TRIGGER set_product_tsvector
  BEFORE INSERT OR UPDATE OF name, name_kz, brand, ingredients_raw
  ON public.global_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_tsvector();

-- ══════════════════════════════════════════════════════════════
-- Composite index for catalog queries by store
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_store_products_ean_active
  ON public.store_products (ean)
  WHERE is_active = true;
