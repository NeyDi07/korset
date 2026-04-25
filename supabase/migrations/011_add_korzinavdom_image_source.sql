ALTER TABLE public.global_products
  DROP CONSTRAINT IF EXISTS global_products_image_source_check;

ALTER TABLE public.global_products
  ADD CONSTRAINT global_products_image_source_check
  CHECK (image_source IS NULL OR image_source IN (
    'openfoodfacts', 'kaspi', 'arbuz', 'korzinavdom', 'ean-db', 'local', 'other'
  ));

UPDATE public.global_products
SET image_source = 'korzinavdom'
WHERE image_url LIKE '%korzinavdom.kz%' AND image_source IS NULL;
