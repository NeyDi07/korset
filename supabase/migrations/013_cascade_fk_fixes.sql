-- Migration 013: Fix ON DELETE for all remaining foreign keys
-- ══════════════════════════════════════════════════════════════
-- 13 FKs still have NO ACTION (default) — deleting parent rows fails
-- or leaves orphaned records.
--
-- Rules:
--   store deleted     → cascade its data (staging, matches, deliveries)
--                      SET NULL on cross-reference (scan_events keep history)
--   global_product deleted → SET NULL (scan history preserved)
--   user deleted      → CASCADE own content (favorites, reviews)
--                      SET NULL on cross-reference (scan history preserved)
-- ══════════════════════════════════════════════════════════════

-- scan_events: 4 FKs
ALTER TABLE public.scan_events
  DROP CONSTRAINT IF EXISTS scan_events_global_product_id_fkey;
ALTER TABLE public.scan_events
  ADD CONSTRAINT scan_events_global_product_id_fkey
  FOREIGN KEY (global_product_id) REFERENCES public.global_products(id)
  ON DELETE SET NULL;

ALTER TABLE public.scan_events
  DROP CONSTRAINT IF EXISTS scan_events_store_product_id_fkey;
ALTER TABLE public.scan_events
  ADD CONSTRAINT scan_events_store_product_id_fkey
  FOREIGN KEY (store_product_id) REFERENCES public.store_products(id)
  ON DELETE SET NULL;

ALTER TABLE public.scan_events
  DROP CONSTRAINT IF EXISTS scan_events_store_id_fkey;
ALTER TABLE public.scan_events
  ADD CONSTRAINT scan_events_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES public.stores(id)
  ON DELETE SET NULL;

ALTER TABLE public.scan_events
  DROP CONSTRAINT IF EXISTS scan_events_user_id_fkey;
ALTER TABLE public.scan_events
  ADD CONSTRAINT scan_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON DELETE SET NULL;

-- missing_products: 2 FKs
ALTER TABLE public.missing_products
  DROP CONSTRAINT IF EXISTS missing_products_store_id_fkey;
ALTER TABLE public.missing_products
  ADD CONSTRAINT missing_products_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES public.stores(id)
  ON DELETE CASCADE;

ALTER TABLE public.missing_products
  DROP CONSTRAINT IF EXISTS missing_products_resolved_global_product_id_fkey;
ALTER TABLE public.missing_products
  ADD CONSTRAINT missing_products_resolved_global_product_id_fkey
  FOREIGN KEY (resolved_global_product_id) REFERENCES public.global_products(id)
  ON DELETE SET NULL;

-- product_matches: 2 FKs
ALTER TABLE public.product_matches
  DROP CONSTRAINT IF EXISTS product_matches_store_product_id_fkey;
ALTER TABLE public.product_matches
  ADD CONSTRAINT product_matches_store_product_id_fkey
  FOREIGN KEY (store_product_id) REFERENCES public.store_products(id)
  ON DELETE CASCADE;

ALTER TABLE public.product_matches
  DROP CONSTRAINT IF EXISTS product_matches_global_product_id_fkey;
ALTER TABLE public.product_matches
  ADD CONSTRAINT product_matches_global_product_id_fkey
  FOREIGN KEY (global_product_id) REFERENCES public.global_products(id)
  ON DELETE SET NULL;

-- product_reviews: 2 FKs
ALTER TABLE public.product_reviews
  DROP CONSTRAINT IF EXISTS product_reviews_global_product_id_fkey;
ALTER TABLE public.product_reviews
  ADD CONSTRAINT product_reviews_global_product_id_fkey
  FOREIGN KEY (global_product_id) REFERENCES public.global_products(id)
  ON DELETE SET NULL;

ALTER TABLE public.product_reviews
  DROP CONSTRAINT IF EXISTS product_reviews_user_id_fkey;
ALTER TABLE public.product_reviews
  ADD CONSTRAINT product_reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON DELETE CASCADE;

-- user_favorites: 2 FKs
ALTER TABLE public.user_favorites
  DROP CONSTRAINT IF EXISTS user_favorites_user_id_fkey;
ALTER TABLE public.user_favorites
  ADD CONSTRAINT user_favorites_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.user_favorites
  DROP CONSTRAINT IF EXISTS user_favorites_global_product_id_fkey;
ALTER TABLE public.user_favorites
  ADD CONSTRAINT user_favorites_global_product_id_fkey
  FOREIGN KEY (global_product_id) REFERENCES public.global_products(id)
  ON DELETE SET NULL;

-- notification_deliveries: 1 FK
ALTER TABLE public.notification_deliveries
  DROP CONSTRAINT IF EXISTS notification_deliveries_event_id_fkey;
ALTER TABLE public.notification_deliveries
  ADD CONSTRAINT notification_deliveries_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.notification_events(id)
  ON DELETE CASCADE;

-- external_product_cache: 1 FK
ALTER TABLE public.external_product_cache
  DROP CONSTRAINT IF EXISTS external_product_cache_global_product_id_fkey;
ALTER TABLE public.external_product_cache
  ADD CONSTRAINT external_product_cache_global_product_id_fkey
  FOREIGN KEY (global_product_id) REFERENCES public.global_products(id)
  ON DELETE SET NULL;
