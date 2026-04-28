-- Pre-flight snapshot для миграции 019.
-- Создаёт лёгкие копии затронутых полей в служебной схеме _backup,
-- чтобы можно было откатить без полного бэкапа БД.
--
-- Запускать ПЕРЕД 019_normalize_legacy_allergen_ids.sql.
-- После успешной миграции и проверки (1-2 недели) — DROP SCHEMA _backup CASCADE.

CREATE SCHEMA IF NOT EXISTS _backup;

-- Только id + затронутые поля + timestamp = минимальный размер
CREATE TABLE IF NOT EXISTS _backup.global_products_019 AS
  SELECT id, allergens_json, traces_json, updated_at, now() AS backed_up_at
  FROM public.global_products
  WHERE allergens_json @> '["nuts"]'::jsonb
     OR allergens_json @> '["shellfish"]'::jsonb
     OR traces_json @> '["nuts"]'::jsonb
     OR traces_json @> '["shellfish"]'::jsonb;

CREATE TABLE IF NOT EXISTS _backup.external_product_cache_019 AS
  SELECT id, normalized_allergens_json, normalized_traces_json, updated_at, now() AS backed_up_at
  FROM public.external_product_cache
  WHERE normalized_allergens_json @> '["nuts"]'::jsonb
     OR normalized_allergens_json @> '["shellfish"]'::jsonb
     OR normalized_traces_json @> '["nuts"]'::jsonb
     OR normalized_traces_json @> '["shellfish"]'::jsonb;

CREATE TABLE IF NOT EXISTS _backup.users_019 AS
  SELECT id, preferences, updated_at, now() AS backed_up_at
  FROM public.users
  WHERE preferences->'allergens' @> '["nuts"]'::jsonb
     OR preferences->'allergens' @> '["shellfish"]'::jsonb
     OR preferences->'allergens' @> '["honey"]'::jsonb;

-- Отчёт о размере снапшота
DO $$
DECLARE
  c_global integer;
  c_cache integer;
  c_users integer;
BEGIN
  SELECT COUNT(*) INTO c_global FROM _backup.global_products_019;
  SELECT COUNT(*) INTO c_cache FROM _backup.external_product_cache_019;
  SELECT COUNT(*) INTO c_users FROM _backup.users_019;

  RAISE NOTICE '[019a] Snapshot saved: % global_products, % cache rows, % users',
    c_global, c_cache, c_users;
  RAISE NOTICE '[019a] Now you can safely run 019_normalize_legacy_allergen_ids.sql';
  RAISE NOTICE '[019a] To rollback later: see comments in this file.';
END $$;

-- ════════════════════════════════════════════════════════════════
-- ROLLBACK (если 019 что-то сломал — раскомментировать и запустить):
-- ════════════════════════════════════════════════════════════════
--
-- BEGIN;
--
-- UPDATE public.global_products g
-- SET allergens_json = b.allergens_json, traces_json = b.traces_json, updated_at = b.updated_at
-- FROM _backup.global_products_019 b
-- WHERE g.id = b.id;
--
-- UPDATE public.external_product_cache c
-- SET normalized_allergens_json = b.normalized_allergens_json,
--     normalized_traces_json = b.normalized_traces_json,
--     updated_at = b.updated_at
-- FROM _backup.external_product_cache_019 b
-- WHERE c.id = b.id;
--
-- UPDATE public.users u
-- SET preferences = b.preferences, updated_at = b.updated_at
-- FROM _backup.users_019 b
-- WHERE u.id = b.id;
--
-- COMMIT;

-- ════════════════════════════════════════════════════════════════
-- CLEANUP (через 1-2 недели после успешной миграции):
-- ════════════════════════════════════════════════════════════════
--
-- DROP SCHEMA _backup CASCADE;
