-- Migration 006: Add alternate_eans for multi-EAN product matching
-- One product can have multiple EANs (different countries, packaging sizes, rebrands)
-- When scanning, we search by primary EAN OR if EAN is in alternate_eans

-- Add alternate_eans column
ALTER TABLE public.global_products
  ADD COLUMN IF NOT EXISTS alternate_eans jsonb DEFAULT '[]'::jsonb;

-- GIN index for fast "alternate_eans @> '[ean]'" queries
CREATE INDEX IF NOT EXISTS idx_global_products_alternate_eans_gin
  ON public.global_products USING gin (alternate_eans);

-- Also add to external_product_cache for consistency
ALTER TABLE public.external_product_cache
  ADD COLUMN IF NOT EXISTS normalized_alternate_eans jsonb DEFAULT '[]'::jsonb;
