-- Migration 015: Constraints + missing NOT NULL + missing_products enrichment
-- ══════════════════════════════════════════════════════════════

-- stores.owner_id should NOT NULL — store without owner is data error
-- Only apply if all existing rows have owner_id set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stores'
      AND column_name = 'owner_id'
      AND is_nullable = 'NO'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM public.stores WHERE owner_id IS NULL) THEN
      ALTER TABLE public.stores ALTER COLUMN owner_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- Expand external_product_cache source CHECK to match current reality
ALTER TABLE public.external_product_cache
  DROP CONSTRAINT IF EXISTS external_product_cache_source_check;

ALTER TABLE public.external_product_cache
  ADD CONSTRAINT external_product_cache_source_check
  CHECK (source IN (
    'openfoodfacts',
    'kazfood',
    'manual',
    'eandb',
    'kaspi',
    'npc',
    'arbuz',
    'usda',
    'korzinavdom'
  ));

-- Index on scan_events for analytics queries
CREATE INDEX IF NOT EXISTS idx_scan_events_store_scanned
  ON public.scan_events (store_id, scanned_at DESC)
  WHERE store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scan_events_found_status
  ON public.scan_events (found_status)
  WHERE found_status IS NOT NULL;

-- missing_products: add local_name column for context from price-list import
ALTER TABLE public.missing_products
  ADD COLUMN IF NOT EXISTS local_name text;

ALTER TABLE public.missing_products
  ADD COLUMN IF NOT EXISTS last_import_price_kzt integer;

-- Unknown_ean_staging: updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.unknown_ean_staging;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.unknown_ean_staging
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- import_batches: updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.import_batches;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.import_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
