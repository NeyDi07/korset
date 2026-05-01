-- Migration 022: Category normalization
-- Adds category_raw/subcategory_raw for original values, then normalization script will update category/subcategory

-- Step 1: Add raw columns to preserve originals
ALTER TABLE public.global_products
  ADD COLUMN IF NOT EXISTS category_raw text,
  ADD COLUMN IF NOT EXISTS subcategory_raw text;

-- Step 2: Copy current values to raw columns
UPDATE public.global_products
  SET category_raw = category,
      subcategory_raw = subcategory
  WHERE category_raw IS NULL AND category IS NOT NULL;

-- Step 3: Add CHECK constraint for normalized category keys (enforced after normalization)
-- Valid keys: dairy_eggs, meat, deli, fish, water_beverages, tea_coffee, sweets, snacks, grocery, sauces_spices, bread, frozen, fruits_veg, baby_food, ready_meals, healthy, personal_care, household
ALTER TABLE public.global_products
  DROP CONSTRAINT IF EXISTS chk_category_normalized;

ALTER TABLE public.global_products
  ADD CONSTRAINT chk_category_normalized
  CHECK (category IS NULL OR category = ANY (ARRAY[
    'dairy_eggs', 'meat', 'deli', 'fish', 'water_beverages', 'tea_coffee',
    'sweets', 'snacks', 'grocery', 'sauces_spices', 'bread', 'frozen',
    'fruits_veg', 'baby_food', 'ready_meals', 'healthy', 'personal_care', 'household'
  ]));

-- Step 4: Index for category filtering (replace old composite index)
DROP INDEX IF EXISTS public.idx_global_products_category;
CREATE INDEX IF NOT EXISTS idx_global_products_category_normalized
  ON public.global_products (category, subcategory)
  WHERE is_active = true;
