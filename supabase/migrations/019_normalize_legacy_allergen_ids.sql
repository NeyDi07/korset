-- Migration 019: Normalize legacy allergen IDs in DB
--
-- Контекст:
--   normalizers.js до 2026-04-28 использовал устаревший дубликат OFF_ALLERGEN_MAP,
--   который маппил OFF-теги в legacy ID:
--     • 'en:nuts'        → 'nuts'      (а должно tree_nuts)
--     • 'en:crustaceans' → 'shellfish' (а должно crustaceans)
--     • 6 ТР ТС аллергенов вообще терялось (mollusks, sesame, celery, mustard, lupin, sulfites)
--
--   Фикс normalizers.js работает только для НОВЫХ импортов из OFF.
--   Существующие данные в БД остаются с legacy ID → fitCheck не matches → ложный safe.
--
-- Что делает:
--   1. Заменяет 'nuts' → 'tree_nuts' и 'shellfish' → 'crustaceans' в:
--      • global_products.allergens_json
--      • global_products.traces_json
--      • external_product_cache.normalized_allergens_json
--      • external_product_cache.normalized_traces_json
--      • users.preferences->allergens (профили пользователей)
--   2. Перемещает 'honey' из users.preferences->allergens в customAllergens
--      (honey убран из ТР ТС-списка, но сохраняем как кастомный — чтобы пользователь не потерял настройку)
--   3. Дедуплицирует массивы (если случайно и 'nuts' и 'tree_nuts' оказались вместе).
--
-- Свойства:
--   • Idempotent — повторное выполнение безопасно (UPDATE сравнивает старое vs новое).
--   • Транзакционность — всё или ничего.
--   • Логирование — RAISE NOTICE на каждом шаге.
--   • Не теряет данные — honey мигрируется, не удаляется.
--   • НИКАКИХ потерь предупреждений: после миграции пользователь с 'tree_nuts' в профиле
--     будет получать danger на товаре с 'tree_nuts' в allergens (раньше товар был как 'nuts' → safe).
--
-- Запуск (Supabase Studio → SQL Editor):
--   Просто выполнить весь файл. NOTICE'ы покажут сколько строк затронуто.

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- Helper: перезаписать массив с заменой 2 legacy ID
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.normalize_allergen_array(arr jsonb)
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
            WHEN value #>> '{}' = 'nuts' THEN to_jsonb('tree_nuts'::text)
            WHEN value #>> '{}' = 'shellfish' THEN to_jsonb('crustaceans'::text)
            ELSE value
          END AS new_value
        FROM jsonb_array_elements(arr) value
      ) sub
    ),
    '[]'::jsonb
  );
$$;

-- ────────────────────────────────────────────────────────────────
-- 1. global_products.allergens_json
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.global_products
  SET
    allergens_json = pg_temp.normalize_allergen_array(allergens_json),
    updated_at = now()
  WHERE allergens_json IS NOT NULL
    AND (allergens_json @> '["nuts"]'::jsonb OR allergens_json @> '["shellfish"]'::jsonb);

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '[019] global_products.allergens_json: % rows updated', affected_count;
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
    traces_json = pg_temp.normalize_allergen_array(traces_json),
    updated_at = now()
  WHERE traces_json IS NOT NULL
    AND (traces_json @> '["nuts"]'::jsonb OR traces_json @> '["shellfish"]'::jsonb);

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '[019] global_products.traces_json: % rows updated', affected_count;
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
    normalized_allergens_json = pg_temp.normalize_allergen_array(normalized_allergens_json),
    updated_at = now()
  WHERE normalized_allergens_json IS NOT NULL
    AND (
      normalized_allergens_json @> '["nuts"]'::jsonb OR
      normalized_allergens_json @> '["shellfish"]'::jsonb
    );

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '[019] external_product_cache.normalized_allergens_json: % rows updated', affected_count;
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
    normalized_traces_json = pg_temp.normalize_allergen_array(normalized_traces_json),
    updated_at = now()
  WHERE normalized_traces_json IS NOT NULL
    AND (
      normalized_traces_json @> '["nuts"]'::jsonb OR
      normalized_traces_json @> '["shellfish"]'::jsonb
    );

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '[019] external_product_cache.normalized_traces_json: % rows updated', affected_count;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 5. users.preferences (профили пользователей)
--    Структура: { allergens: [...], customAllergens: [...], healthConditions: [...], ... }
--    Действия:
--      a) allergens: 'nuts' → 'tree_nuts', 'shellfish' → 'crustaceans'
--      b) 'honey' → переместить в customAllergens (если его там ещё нет)
--      c) дедуплицировать
-- ────────────────────────────────────────────────────────────────

-- 5a + 5c: nuts/shellfish + дедупликация
DO $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.users
  SET
    preferences = jsonb_set(
      preferences,
      '{allergens}',
      pg_temp.normalize_allergen_array(preferences->'allergens')
    ),
    updated_at = now()
  WHERE preferences ? 'allergens'
    AND jsonb_typeof(preferences->'allergens') = 'array'
    AND (
      preferences->'allergens' @> '["nuts"]'::jsonb OR
      preferences->'allergens' @> '["shellfish"]'::jsonb
    );

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '[019] users.preferences->allergens: % rows updated (nuts/shellfish)', affected_count;
END $$;

-- 5b: honey → customAllergens (для пользователей, у кого honey в allergens)
DO $$
DECLARE
  affected_count integer;
BEGIN
  WITH affected_users AS (
    SELECT
      id,
      -- Удалить 'honey' из allergens
      (
        SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
        FROM jsonb_array_elements(preferences->'allergens') value
        WHERE value #>> '{}' <> 'honey'
      ) AS new_allergens,
      -- Добавить 'Мёд' в customAllergens (если ещё нет)
      CASE
        WHEN preferences ? 'customAllergens'
             AND jsonb_typeof(preferences->'customAllergens') = 'array'
             AND NOT (preferences->'customAllergens' @> '["Мёд"]'::jsonb)
          THEN (preferences->'customAllergens') || '["Мёд"]'::jsonb
        WHEN NOT (preferences ? 'customAllergens')
             OR jsonb_typeof(preferences->'customAllergens') <> 'array'
          THEN '["Мёд"]'::jsonb
        ELSE preferences->'customAllergens'
      END AS new_custom_allergens
    FROM public.users
    WHERE preferences ? 'allergens'
      AND jsonb_typeof(preferences->'allergens') = 'array'
      AND preferences->'allergens' @> '["honey"]'::jsonb
  )
  UPDATE public.users u
  SET
    preferences = jsonb_set(
      jsonb_set(u.preferences, '{allergens}', a.new_allergens),
      '{customAllergens}',
      a.new_custom_allergens
    ),
    updated_at = now()
  FROM affected_users a
  WHERE u.id = a.id;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '[019] users.preferences: % users had honey moved to customAllergens', affected_count;
END $$;

-- ────────────────────────────────────────────────────────────────
-- Верификация: убедиться, что legacy ID полностью исчезли
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  remaining_global integer;
  remaining_cache integer;
  remaining_users integer;
BEGIN
  SELECT COUNT(*) INTO remaining_global
  FROM public.global_products
  WHERE allergens_json @> '["nuts"]'::jsonb
     OR allergens_json @> '["shellfish"]'::jsonb
     OR traces_json @> '["nuts"]'::jsonb
     OR traces_json @> '["shellfish"]'::jsonb;

  SELECT COUNT(*) INTO remaining_cache
  FROM public.external_product_cache
  WHERE normalized_allergens_json @> '["nuts"]'::jsonb
     OR normalized_allergens_json @> '["shellfish"]'::jsonb
     OR normalized_traces_json @> '["nuts"]'::jsonb
     OR normalized_traces_json @> '["shellfish"]'::jsonb;

  SELECT COUNT(*) INTO remaining_users
  FROM public.users
  WHERE preferences->'allergens' @> '["nuts"]'::jsonb
     OR preferences->'allergens' @> '["shellfish"]'::jsonb
     OR preferences->'allergens' @> '["honey"]'::jsonb;

  IF remaining_global + remaining_cache + remaining_users > 0 THEN
    RAISE EXCEPTION '[019] Verification failed: % global_products, % cache rows, % users still contain legacy IDs',
      remaining_global, remaining_cache, remaining_users;
  END IF;

  RAISE NOTICE '[019] Verification OK: 0 rows remain with legacy allergen IDs';
END $$;

COMMIT;

-- ════════════════════════════════════════════════════════════════
-- ВНЕ транзакции: REINDEX GIN-индексов на allergens (после массового UPDATE)
-- Опционально, но рекомендуется для восстановления производительности.
-- Раскомментируйте при необходимости:
--
-- REINDEX INDEX CONCURRENTLY idx_global_products_allergens_gin;
-- REINDEX INDEX CONCURRENTLY idx_external_cache_allergens_gin;
-- ════════════════════════════════════════════════════════════════
