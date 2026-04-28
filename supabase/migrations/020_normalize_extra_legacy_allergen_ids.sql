-- Migration 020: Normalize extra legacy allergen IDs (продолжение 019)
--
-- Контекст:
--   После запуска 019 был сделан более глубокий аудит источников импорта
--   (scripts/import-off-jsonl.cjs, scripts/seed-products.js, scripts/import-eandb.js).
--   Они использовали РАЗНЫЕ варианты ID, не только 'nuts'/'shellfish':
--     • 'molluscs'   (OFF-форма с -s)  → должно 'mollusks'
--     • 'sulphites'  (BrE-форма)       → должно 'sulfites'
--     • 'tree-nuts'  (с дефисом)       → должно 'tree_nuts' (через нижнее подчёркивание)
--
--   Если эти скрипты запускались — в global_products / external_product_cache
--   могут лежать товары с этими ID. fitCheck сравнивает их с профилем пользователя
--   (где сидит 'mollusks'/'sulfites'/'tree_nuts') — НЕ matches → ложный safe.
--
-- Что делает: то же что и 019, но для трёх новых пар.
--   1. global_products.allergens_json
--   2. global_products.traces_json
--   3. external_product_cache.normalized_allergens_json
--   4. external_product_cache.normalized_traces_json
--   5. users.preferences->allergens (на всякий случай)
--
-- Свойства: idempotent, транзакционна, логирует, верифицирует.

BEGIN;

-- Helper для замены 3 пар ID
CREATE OR REPLACE FUNCTION pg_temp.normalize_extra_allergen_array(arr jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(DISTINCT new_value)
      FROM (
        SELECT
          CASE
            WHEN value #>> '{}' = 'molluscs'  THEN to_jsonb('mollusks'::text)
            WHEN value #>> '{}' = 'sulphites' THEN to_jsonb('sulfites'::text)
            WHEN value #>> '{}' = 'tree-nuts' THEN to_jsonb('tree_nuts'::text)
            ELSE value
          END AS new_value
        FROM jsonb_array_elements(arr) value
      ) sub
    ),
    '[]'::jsonb
  );
$$;

-- Pre-flight snapshot (additive — добавляем в уже существующую _backup схему)
CREATE TABLE IF NOT EXISTS _backup.global_products_020 AS
  SELECT id, allergens_json, traces_json, updated_at, now() AS backed_up_at
  FROM public.global_products
  WHERE allergens_json @> '["molluscs"]'::jsonb
     OR allergens_json @> '["sulphites"]'::jsonb
     OR allergens_json @> '["tree-nuts"]'::jsonb
     OR traces_json @> '["molluscs"]'::jsonb
     OR traces_json @> '["sulphites"]'::jsonb
     OR traces_json @> '["tree-nuts"]'::jsonb;

CREATE TABLE IF NOT EXISTS _backup.external_product_cache_020 AS
  SELECT id, normalized_allergens_json, normalized_traces_json, updated_at, now() AS backed_up_at
  FROM public.external_product_cache
  WHERE normalized_allergens_json @> '["molluscs"]'::jsonb
     OR normalized_allergens_json @> '["sulphites"]'::jsonb
     OR normalized_allergens_json @> '["tree-nuts"]'::jsonb
     OR normalized_traces_json @> '["molluscs"]'::jsonb
     OR normalized_traces_json @> '["sulphites"]'::jsonb
     OR normalized_traces_json @> '["tree-nuts"]'::jsonb;

CREATE TABLE IF NOT EXISTS _backup.users_020 AS
  SELECT id, preferences, updated_at, now() AS backed_up_at
  FROM public.users
  WHERE preferences->'allergens' @> '["molluscs"]'::jsonb
     OR preferences->'allergens' @> '["sulphites"]'::jsonb
     OR preferences->'allergens' @> '["tree-nuts"]'::jsonb;

-- ────────────────────────────────────────────────────────────────
-- 1. global_products.allergens_json
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.global_products
  SET
    allergens_json = pg_temp.normalize_extra_allergen_array(allergens_json),
    updated_at = now()
  WHERE allergens_json IS NOT NULL
    AND (allergens_json @> '["molluscs"]'::jsonb
      OR allergens_json @> '["sulphites"]'::jsonb
      OR allergens_json @> '["tree-nuts"]'::jsonb);

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '[020] global_products.allergens_json: % rows updated', affected_count;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 2. global_products.traces_json
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.global_products
  SET
    traces_json = pg_temp.normalize_extra_allergen_array(traces_json),
    updated_at = now()
  WHERE traces_json IS NOT NULL
    AND (traces_json @> '["molluscs"]'::jsonb
      OR traces_json @> '["sulphites"]'::jsonb
      OR traces_json @> '["tree-nuts"]'::jsonb);

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '[020] global_products.traces_json: % rows updated', affected_count;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 3. external_product_cache.normalized_allergens_json
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.external_product_cache
  SET
    normalized_allergens_json = pg_temp.normalize_extra_allergen_array(normalized_allergens_json),
    updated_at = now()
  WHERE normalized_allergens_json IS NOT NULL
    AND (normalized_allergens_json @> '["molluscs"]'::jsonb
      OR normalized_allergens_json @> '["sulphites"]'::jsonb
      OR normalized_allergens_json @> '["tree-nuts"]'::jsonb);

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '[020] external_product_cache.normalized_allergens_json: % rows updated', affected_count;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 4. external_product_cache.normalized_traces_json
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.external_product_cache
  SET
    normalized_traces_json = pg_temp.normalize_extra_allergen_array(normalized_traces_json),
    updated_at = now()
  WHERE normalized_traces_json IS NOT NULL
    AND (normalized_traces_json @> '["molluscs"]'::jsonb
      OR normalized_traces_json @> '["sulphites"]'::jsonb
      OR normalized_traces_json @> '["tree-nuts"]'::jsonb);

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '[020] external_product_cache.normalized_traces_json: % rows updated', affected_count;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 5. users.preferences->allergens (на всякий случай — обычно пользователь не выбирает molluscs руками)
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.users
  SET
    preferences = jsonb_set(
      preferences,
      '{allergens}',
      pg_temp.normalize_extra_allergen_array(preferences->'allergens')
    ),
    updated_at = now()
  WHERE preferences ? 'allergens'
    AND jsonb_typeof(preferences->'allergens') = 'array'
    AND (preferences->'allergens' @> '["molluscs"]'::jsonb
      OR preferences->'allergens' @> '["sulphites"]'::jsonb
      OR preferences->'allergens' @> '["tree-nuts"]'::jsonb);

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '[020] users.preferences->allergens: % rows updated', affected_count;
END $$;

-- ────────────────────────────────────────────────────────────────
-- Верификация: все 3 пары legacy ID должны исчезнуть
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM public.global_products
      WHERE allergens_json @> '["molluscs"]'::jsonb OR allergens_json @> '["sulphites"]'::jsonb OR allergens_json @> '["tree-nuts"]'::jsonb
         OR traces_json @> '["molluscs"]'::jsonb OR traces_json @> '["sulphites"]'::jsonb OR traces_json @> '["tree-nuts"]'::jsonb)
  + (SELECT COUNT(*) FROM public.external_product_cache
      WHERE normalized_allergens_json @> '["molluscs"]'::jsonb OR normalized_allergens_json @> '["sulphites"]'::jsonb OR normalized_allergens_json @> '["tree-nuts"]'::jsonb
         OR normalized_traces_json @> '["molluscs"]'::jsonb OR normalized_traces_json @> '["sulphites"]'::jsonb OR normalized_traces_json @> '["tree-nuts"]'::jsonb)
  + (SELECT COUNT(*) FROM public.users
      WHERE preferences->'allergens' @> '["molluscs"]'::jsonb OR preferences->'allergens' @> '["sulphites"]'::jsonb OR preferences->'allergens' @> '["tree-nuts"]'::jsonb)
  INTO remaining;

  IF remaining > 0 THEN
    RAISE EXCEPTION '[020] Verification failed: % rows still contain extra legacy IDs', remaining;
  END IF;

  RAISE NOTICE '[020] Verification OK: 0 rows remain with extra legacy allergen IDs';
END $$;

COMMIT;

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (если что-то пошло не так — раскомментировать):
-- ════════════════════════════════════════════════════════════════
--
-- BEGIN;
-- UPDATE public.global_products g
-- SET allergens_json = b.allergens_json, traces_json = b.traces_json, updated_at = b.updated_at
-- FROM _backup.global_products_020 b WHERE g.id = b.id;
--
-- UPDATE public.external_product_cache c
-- SET normalized_allergens_json = b.normalized_allergens_json,
--     normalized_traces_json = b.normalized_traces_json,
--     updated_at = b.updated_at
-- FROM _backup.external_product_cache_020 b WHERE c.id = b.id;
--
-- UPDATE public.users u
-- SET preferences = b.preferences, updated_at = b.updated_at
-- FROM _backup.users_020 b WHERE u.id = b.id;
-- COMMIT;
