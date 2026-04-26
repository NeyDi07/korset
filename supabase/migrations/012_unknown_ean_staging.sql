-- Migration 012: Unknown EAN staging + Bulk RPC + Data Moat foundation
-- ══════════════════════════════════════════════════════════════════
-- 1. import_batches — tracks each price-list import session
-- 2. unknown_ean_staging — unknown EANs waiting for enrichment
-- 3. RLS policies for new tables
-- 4. bulk_update_store_products RPC — fast batch UPDATE
-- 5. stage_unknown_eans RPC — write unknown EANs to staging + missing_products
-- 6. resolve_unknown_eans RPC — auto-link found EANs to store catalog
-- 7. calc_data_quality_score function — score from source + completeness
-- 8. source_updated_at + data_quality_score columns on global_products
-- ══════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 1. import_batches
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  file_name text,
  total_rows int NOT NULL DEFAULT 0,
  known_rows int NOT NULL DEFAULT 0,
  unknown_rows int NOT NULL DEFAULT 0,
  auto_resolved_rows int NOT NULL DEFAULT 0,
  applied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_store
  ON public.import_batches (store_id, applied_at DESC);

-- ══════════════════════════════════════════════════════════════
-- 2. unknown_ean_staging
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.unknown_ean_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  ean text NOT NULL,
  local_name text,
  price_kzt integer,
  stock_status text DEFAULT 'in_stock',
  shelf_zone text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'enriching', 'resolved', 'failed', 'ignored')),
  resolution_result jsonb DEFAULT '{}'::jsonb,
  resolved_global_product_id uuid REFERENCES public.global_products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unknown_ean_staging_unique_ean_per_store
    UNIQUE (store_id, ean)
);

CREATE INDEX IF NOT EXISTS idx_unknown_ean_staging_status
  ON public.unknown_ean_staging (store_id, status);

CREATE INDEX IF NOT EXISTS idx_unknown_ean_staging_ean
  ON public.unknown_ean_staging (ean);

-- ══════════════════════════════════════════════════════════════
-- 3. RLS for new tables
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_batches_read_owner" ON public.import_batches
  FOR SELECT TO authenticated USING (
    store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "import_batches_insert_owner" ON public.import_batches
  FOR INSERT TO authenticated WITH CHECK (
    store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  );

ALTER TABLE public.unknown_ean_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unknown_ean_staging_read_owner" ON public.unknown_ean_staging
  FOR SELECT TO authenticated USING (
    store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "unknown_ean_staging_insert_owner" ON public.unknown_ean_staging
  FOR INSERT TO authenticated WITH CHECK (
    store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "unknown_ean_staging_update_owner" ON public.unknown_ean_staging
  FOR UPDATE TO authenticated USING (
    store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  ) WITH CHECK (
    store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
  );

-- ══════════════════════════════════════════════════════════════
-- 4. bulk_update_store_products — batch UPDATE in one call
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bulk_update_store_products(
  p_store_id uuid,
  p_eans text[],
  p_price_kzts integer[],
  p_stock_statuses text[],
  p_shelf_zones text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated integer;
  v_owner boolean;
BEGIN
  SELECT public.is_store_owner_by_id(p_store_id) INTO v_owner;
  IF NOT v_owner THEN
    RAISE EXCEPTION 'Not store owner';
  END IF;

  WITH updated_rows AS (
    UPDATE public.store_products sp
    SET
      price_kzt = d.price_kzt,
      stock_status = d.stock_status,
      shelf_zone = NULLIF(d.shelf_zone, ''),
      updated_at = now()
    FROM unnest(p_eans, p_price_kzts, p_stock_statuses, p_shelf_zones)
      AS d(ean, price_kzt, stock_status, shelf_zone)
    WHERE sp.ean = d.ean
      AND sp.store_id = p_store_id
      AND sp.is_active = true
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_updated FROM updated_rows;

  RETURN v_updated;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 5. stage_unknown_eans — write to staging + missing_products
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.stage_unknown_eans(
  p_store_id uuid,
  p_eans text[],
  p_local_names text[],
  p_price_kzts integer[],
  p_stock_statuses text[],
  p_shelf_zones text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
  v_owner boolean;
BEGIN
  SELECT public.is_store_owner_by_id(p_store_id) INTO v_owner;
  IF NOT v_owner THEN
    RAISE EXCEPTION 'Not store owner';
  END IF;

  INSERT INTO public.unknown_ean_staging (store_id, ean, local_name, price_kzt, stock_status, shelf_zone)
  SELECT p_store_id, d.ean, NULLIF(d.local_name, ''), d.price_kzt, d.stock_status, NULLIF(d.shelf_zone, '')
  FROM unnest(p_eans, p_local_names, p_price_kzts, p_stock_statuses, p_shelf_zones)
    AS d(ean, local_name, price_kzt, stock_status, shelf_zone)
  ON CONFLICT (store_id, ean)
  DO UPDATE SET
    local_name = EXCLUDED.local_name,
    price_kzt = EXCLUDED.price_kzt,
    stock_status = EXCLUDED.stock_status,
    shelf_zone = EXCLUDED.shelf_zone,
    status = CASE
      WHEN unknown_ean_staging.status = 'resolved' THEN 'resolved'
      ELSE 'pending'
    END,
    updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.missing_products (ean, store_id, scan_count, first_seen_at, last_seen_at, resolved)
  SELECT d.ean, p_store_id, 1, now(), now(), false
  FROM unnest(p_eans) AS d(ean)
  ON CONFLICT (store_id, ean)
  DO UPDATE SET
    scan_count = missing_products.scan_count + 1,
    last_seen_at = now(),
    resolved = false;

  RETURN v_count;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 6. resolve_unknown_eans — auto-link found EANs to store
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.resolve_unknown_eans(
  p_store_id uuid,
  p_limit int DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_resolved integer;
  v_owner boolean;
  v_staging record;
  v_global_id uuid;
  v_sp_id uuid;
  v_count integer := 0;
BEGIN
  SELECT public.is_store_owner_by_id(p_store_id) INTO v_owner;
  IF NOT v_owner THEN
    RAISE EXCEPTION 'Not store owner';
  END IF;

  FOR v_staging IN
    SELECT id, ean, price_kzt, stock_status, shelf_zone
    FROM public.unknown_ean_staging
    WHERE store_id = p_store_id
      AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT p_limit
  LOOP
    SELECT g.id INTO v_global_id
    FROM public.global_products g
    WHERE g.ean = v_staging.ean
      AND g.is_active = true
    LIMIT 1;

    IF v_GLOBAL_ID IS NOT NULL THEN
      INSERT INTO public.store_products (store_id, ean, global_product_id, price_kzt, stock_status, shelf_zone, is_active)
      VALUES (p_store_id, v_staging.ean, v_global_id, v_staging.price_kzt, v_staging.stock_status, v_staging.shelf_zone, true)
      ON CONFLICT (store_id, ean)
      DO UPDATE SET
        global_product_id = v_global_id,
        price_kzt = EXCLUDED.price_kzt,
        stock_status = EXCLUDED.stock_status,
        shelf_zone = EXCLUDED.shelf_zone,
        is_active = true,
        updated_at = now()
      RETURNING id INTO v_sp_id;

      UPDATE public.unknown_ean_staging
      SET status = 'resolved',
          resolved_global_product_id = v_global_id,
          resolution_result = jsonb_build_object('method', 'global_products_match', 'store_product_id', v_sp_id),
          updated_at = now()
      WHERE id = v_staging.id;

      UPDATE public.missing_products
      SET resolved = true,
          resolved_global_product_id = v_global_id,
          last_seen_at = now()
      WHERE store_id = p_store_id AND ean = v_staging.ean;

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 7. calc_data_quality_score — quality from source + completeness
-- ══════════════════════════════════════════════════════════════

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

  RETURN v_score;
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- 8. source_updated_at + data_quality_score on global_products
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.global_products
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;

ALTER TABLE public.global_products
  ADD COLUMN IF NOT EXISTS data_quality_score integer DEFAULT 0
  CHECK (data_quality_score >= 0 AND data_quality_score <= 100);

CREATE INDEX IF NOT EXISTS idx_global_products_quality_score
  ON public.global_products (data_quality_score DESC)
  WHERE data_quality_score > 0;

CREATE INDEX IF NOT EXISTS idx_global_products_source_updated
  ON public.global_products (source_updated_at)
  WHERE source_updated_at IS NOT NULL;

-- Backfill quality score for existing rows
UPDATE public.global_products
SET data_quality_score = public.calc_data_quality_score(global_products),
    source_updated_at = COALESCE(source_updated_at, updated_at, created_at)
WHERE data_quality_score = 0 OR data_quality_score IS NULL;

-- Trigger: auto-update quality score on insert/update
CREATE OR REPLACE FUNCTION public.set_data_quality_score()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.data_quality_score := public.calc_data_quality_score(NEW);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_quality_score ON public.global_products;
CREATE TRIGGER set_quality_score
  BEFORE INSERT OR UPDATE ON public.global_products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_data_quality_score();

-- ══════════════════════════════════════════════════════════════
-- 9. TTL: set default + backfill existing cache
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.external_product_cache
  ALTER COLUMN ttl_expires_at SET DEFAULT (now() + interval '30 days');

UPDATE public.external_product_cache
SET ttl_expires_at = now() + interval '30 days'
WHERE ttl_expires_at IS NULL;

-- ══════════════════════════════════════════════════════════════
-- 10. Version unversioned RPCs
-- ══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_top_scanned_products(uuid, integer, integer);
CREATE OR REPLACE FUNCTION public.get_top_scanned_products(
  p_store_id uuid,
  p_days_back int DEFAULT 30,
  p_limit int DEFAULT 10
)
RETURNS TABLE (ean text, scan_count bigint, name text, image_url text, price_kzt integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.ean,
    count(*)::bigint AS scan_count,
    g.name,
    g.image_url,
    sp.price_kzt
  FROM public.scan_events se
  LEFT JOIN public.global_products g ON g.id = se.global_product_id AND g.is_active = true
  LEFT JOIN public.store_products sp ON sp.ean = se.ean AND sp.store_id = se.store_id AND sp.is_active = true
  WHERE se.store_id = p_store_id
    AND se.scanned_at >= now() - (p_days_back || ' days')::interval
  GROUP BY se.ean, g.name, g.image_url, sp.price_kzt
  ORDER BY scan_count DESC
  LIMIT p_limit;
END;
$$;

DROP FUNCTION IF EXISTS public.get_missed_opportunities(uuid, integer, integer);
CREATE OR REPLACE FUNCTION public.get_missed_opportunities(
  p_store_id uuid,
  p_days_back int DEFAULT 30,
  p_limit int DEFAULT 10
)
RETURNS TABLE (ean text, miss_count bigint, name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.ean,
    count(*)::bigint AS miss_count,
    g.name
  FROM public.scan_events se
  LEFT JOIN public.global_products g ON g.id = se.global_product_id AND g.is_active = true
  LEFT JOIN public.store_products sp ON sp.ean = se.ean AND sp.store_id = se.store_id AND sp.is_active = true
  WHERE se.store_id = p_store_id
    AND se.scanned_at >= now() - (p_days_back || ' days')::interval
    AND (sp.id IS NULL OR sp.stock_status = 'out_of_stock')
  GROUP BY se.ean, g.name
  ORDER BY miss_count DESC
  LIMIT p_limit;
END;
$$;
