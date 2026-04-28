-- ═══════════════════════════════════════════════════════════════════════════
-- 018 — DB Foundation (Этап 2 HARDENING_PLAN)
-- ═══════════════════════════════════════════════════════════════════════════
-- Фундаментальные правки БД для масштабирования до 50 магазинов × 10k сканов/день:
--   1. SECURITY DEFINER функции — фикс search_path injection vector
--   2. Atomic RPC для scan_count (вместо read-modify-write на клиенте)
--   3. CHECK constraints на нутриенты, профиль, preferences
--   4. profile-banners storage — file_size_limit + mime types
--   5. tsvector — переход с 'simple' на 'russian' (стемминг RU)
--   6. get_lost_revenue — фикс расчёта (раньше всегда 0 для отсутствующих)
--   7. Vault — закрыть anon чтение (Data Moat защита)
--   8. preferences/avatar/banner — валидация формата
--   9. external_product_cache — anon write через узкий RPC (вместо проседания через service_role)
--
-- Применять через Supabase SQL Editor от service_role.
-- Безопасно для повторного запуска (idempotent: IF NOT EXISTS / OR REPLACE / DROP IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. SECURITY DEFINER FUNCTIONS — фикс search_path
-- ──────────────────────────────────────────────────────────────────────────
-- Без явного SET search_path атакующий с DDL-правами на public может создать
-- функцию-перехват и подменить логику. Все SECURITY DEFINER должны явно
-- указывать search_path.

ALTER FUNCTION public.is_store_owner(public.stores)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.is_store_owner_by_id(uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_unique_customers(uuid, integer)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_lost_revenue(uuid, integer)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_scan_coverage(uuid, integer)
  SET search_path = public, pg_temp;

-- get_top_scanned_products / get_missed_opportunities — нет SECURITY DEFINER (LANGUAGE sql),
-- но добавим search_path для единообразия.
DO $$
BEGIN
  -- Применяем только если функции существуют
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_top_scanned_products') THEN
    ALTER FUNCTION public.get_top_scanned_products(uuid, integer, integer)
      SET search_path = public, pg_temp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_missed_opportunities') THEN
    ALTER FUNCTION public.get_missed_opportunities(uuid, integer, integer)
      SET search_path = public, pg_temp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'bulk_update_store_products') THEN
    ALTER FUNCTION public.bulk_update_store_products(uuid, text[], integer[], text[], text[])
      SET search_path = public, pg_temp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'stage_unknown_eans') THEN
    ALTER FUNCTION public.stage_unknown_eans(uuid, text[], text[], integer[], text[], text[])
      SET search_path = public, pg_temp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'resolve_unknown_eans') THEN
    ALTER FUNCTION public.resolve_unknown_eans(uuid, integer)
      SET search_path = public, pg_temp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calc_data_quality_score') THEN
    ALTER FUNCTION public.calc_data_quality_score(public.global_products)
      SET search_path = public, pg_temp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_data_quality_score') THEN
    ALTER FUNCTION public.set_data_quality_score()
      SET search_path = public, pg_temp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    ALTER FUNCTION public.update_updated_at_column()
      SET search_path = public, pg_temp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_product_tsvector') THEN
    ALTER FUNCTION public.update_product_tsvector()
      SET search_path = public, pg_temp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_vault_updated_at') THEN
    ALTER FUNCTION public.handle_vault_updated_at()
      SET search_path = public, pg_temp;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'match_vault_chunks') THEN
    ALTER FUNCTION public.match_vault_chunks(vector, integer, jsonb)
      SET search_path = public, pg_temp;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. ATOMIC RPC: scan_count increments
-- ──────────────────────────────────────────────────────────────────────────
-- Раньше: клиент читал scan_count, прибавлял 1, обновлял (read-modify-write race).
-- 100 параллельных сканов одного товара → терялось 50+ инкрементов.
-- Теперь: одна SQL операция, индекс на ean делает её O(log N).

CREATE OR REPLACE FUNCTION public.increment_cache_scan_count(p_ean text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.external_product_cache
  SET scan_count = COALESCE(scan_count, 0) + 1,
      updated_at = now()
  WHERE ean = p_ean;
$$;

GRANT EXECUTE ON FUNCTION public.increment_cache_scan_count(text)
  TO authenticated, anon, service_role;

-- missing_products — ON CONFLICT инкремент (раньше всегда писал scan_count = 1 на upsert)
CREATE OR REPLACE FUNCTION public.increment_missing_scan_count(p_ean text, p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_ean !~ '^\d{8,14}$' THEN
    RAISE EXCEPTION 'Invalid EAN format';
  END IF;
  INSERT INTO public.missing_products (ean, store_id, scan_count, first_seen_at, last_seen_at, resolved)
  VALUES (p_ean, p_store_id, 1, now(), now(), false)
  ON CONFLICT (store_id, ean)
  DO UPDATE SET
    scan_count = missing_products.scan_count + 1,
    last_seen_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_missing_scan_count(text, uuid)
  TO authenticated, anon, service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. EXTERNAL_PRODUCT_CACHE — публичный write через узкий RPC
-- ──────────────────────────────────────────────────────────────────────────
-- Раньше: клиент пытался upsert напрямую → RLS deny для anon → кэш протекал
-- (каждый anon-скан незнакомого товара снова дёргал OFF, бюджет AI выгорал).
-- Теперь: SECURITY DEFINER RPC с валидацией EAN.

CREATE OR REPLACE FUNCTION public.upsert_external_cache(
  p_ean text,
  p_source text,
  p_normalized_name text DEFAULT NULL,
  p_normalized_brand text DEFAULT NULL,
  p_normalized_description text DEFAULT NULL,
  p_normalized_category text DEFAULT NULL,
  p_normalized_quantity text DEFAULT NULL,
  p_normalized_ingredients text DEFAULT NULL,
  p_normalized_allergens jsonb DEFAULT '[]'::jsonb,
  p_normalized_diet_tags jsonb DEFAULT '[]'::jsonb,
  p_normalized_additives_tags jsonb DEFAULT '[]'::jsonb,
  p_normalized_traces jsonb DEFAULT '[]'::jsonb,
  p_normalized_nutriments jsonb DEFAULT '{}'::jsonb,
  p_image_url text DEFAULT NULL,
  p_nutriscore text DEFAULT NULL,
  p_nova_group smallint DEFAULT NULL,
  p_raw_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Validate EAN
  IF p_ean !~ '^\d{8,14}$' THEN
    RAISE EXCEPTION 'Invalid EAN format';
  END IF;

  -- Validate source against existing CHECK constraint
  IF p_source NOT IN (
    'openfoodfacts', 'kazfood', 'manual', 'ai_enriched',
    'arbuz', 'kaspi', 'korzinavdom', 'usda', 'npc'
  ) THEN
    RAISE EXCEPTION 'Invalid source';
  END IF;

  INSERT INTO public.external_product_cache (
    ean, source,
    normalized_name, normalized_brand, normalized_description, normalized_category,
    normalized_quantity, normalized_ingredients,
    normalized_allergens_json, normalized_diet_tags_json, normalized_additives_tags_json,
    normalized_traces_json, normalized_nutriments_json,
    image_url, nutriscore, nova_group, raw_payload,
    scan_count, ttl_expires_at, updated_at
  ) VALUES (
    p_ean, p_source,
    p_normalized_name, p_normalized_brand, p_normalized_description, p_normalized_category,
    p_normalized_quantity, p_normalized_ingredients,
    p_normalized_allergens, p_normalized_diet_tags, p_normalized_additives_tags,
    p_normalized_traces, p_normalized_nutriments,
    p_image_url, p_nutriscore, p_nova_group, p_raw_payload,
    1, now() + interval '30 days', now()
  )
  ON CONFLICT (ean) DO UPDATE SET
    source = EXCLUDED.source,
    normalized_name = COALESCE(EXCLUDED.normalized_name, external_product_cache.normalized_name),
    normalized_brand = COALESCE(EXCLUDED.normalized_brand, external_product_cache.normalized_brand),
    normalized_description = COALESCE(EXCLUDED.normalized_description, external_product_cache.normalized_description),
    normalized_category = COALESCE(EXCLUDED.normalized_category, external_product_cache.normalized_category),
    normalized_quantity = COALESCE(EXCLUDED.normalized_quantity, external_product_cache.normalized_quantity),
    normalized_ingredients = COALESCE(EXCLUDED.normalized_ingredients, external_product_cache.normalized_ingredients),
    normalized_allergens_json = EXCLUDED.normalized_allergens_json,
    normalized_diet_tags_json = EXCLUDED.normalized_diet_tags_json,
    normalized_additives_tags_json = EXCLUDED.normalized_additives_tags_json,
    normalized_traces_json = EXCLUDED.normalized_traces_json,
    normalized_nutriments_json = EXCLUDED.normalized_nutriments_json,
    image_url = COALESCE(EXCLUDED.image_url, external_product_cache.image_url),
    nutriscore = COALESCE(EXCLUDED.nutriscore, external_product_cache.nutriscore),
    nova_group = COALESCE(EXCLUDED.nova_group, external_product_cache.nova_group),
    raw_payload = EXCLUDED.raw_payload,
    scan_count = external_product_cache.scan_count + 1,
    ttl_expires_at = now() + interval '30 days',
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_external_cache(
  text, text, text, text, text, text, text, text,
  jsonb, jsonb, jsonb, jsonb, jsonb, text, text, smallint, jsonb
) TO authenticated, anon, service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. VALIDATION CHECK CONSTRAINTS
-- ──────────────────────────────────────────────────────────────────────────

-- Nutrients: physical limits (раньше можно было записать 9999% жирности)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_alcohol_range' AND conrelid = 'public.global_products'::regclass
  ) THEN
    ALTER TABLE public.global_products
      ADD CONSTRAINT check_alcohol_range
      CHECK (alcohol_100g IS NULL OR (alcohol_100g >= 0 AND alcohol_100g <= 100));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_saturated_fat_range' AND conrelid = 'public.global_products'::regclass
  ) THEN
    ALTER TABLE public.global_products
      ADD CONSTRAINT check_saturated_fat_range
      CHECK (saturated_fat_100g IS NULL OR (saturated_fat_100g >= 0 AND saturated_fat_100g <= 100));
  END IF;
END $$;

-- Users.preferences — лимит размера (защита от DevTools-инъекций 10MB JSON)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_preferences_size' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT check_preferences_size
      CHECK (preferences IS NULL OR octet_length(preferences::text) < 16384);
  END IF;
END $$;

-- avatar_id формат: либо preset 'av1'..'av99', либо https URL до 256 символов
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_avatar_id_format' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT check_avatar_id_format
      CHECK (
        avatar_id IS NULL
        OR (length(avatar_id) <= 256 AND avatar_id ~ '^(av[0-9]+|https?://[^[:space:]]+)$')
      );
  END IF;
END $$;

-- banner_url формат: либо preset 'preset:name', либо https URL до 512 символов
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_banner_url_format' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT check_banner_url_format
      CHECK (
        banner_url IS NULL
        OR (length(banner_url) <= 512 AND banner_url ~ '^(preset:[a-z0-9_-]+|https?://[^[:space:]]+)$')
      );
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 5. STORAGE: profile-banners limits
-- ──────────────────────────────────────────────────────────────────────────
-- Миграция 016 создала bucket БЕЗ file_size_limit и mime types.
-- Юзер мог загрузить 100MB EXE-файл и Storage его принял бы.

UPDATE storage.buckets
SET
  file_size_limit = 2097152,  -- 2 MB
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'profile-banners';

-- ──────────────────────────────────────────────────────────────────────────
-- 6. TSVECTOR: переход с 'simple' на 'russian' (стемминг)
-- ──────────────────────────────────────────────────────────────────────────
-- Раньше: 'simple' игнорирует морфологию → "молоко" не находится по запросу "молока".
-- Теперь: 'russian' стемминг + сохраняем 'simple' для точных совпадений (бренды).

CREATE OR REPLACE FUNCTION public.update_product_tsvector()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Имя: russian для русского, simple как fallback для лат/казахских
  NEW.name_tsvector :=
    setweight(to_tsvector('russian', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(NEW.name_kz, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'C');
  -- Бренды: simple, чтобы не стеммить названия
  NEW.brand_tsvector := to_tsvector('simple', coalesce(NEW.brand, ''));
  -- Состав: russian для нормального поиска по словам
  NEW.ingredients_tsvector := to_tsvector('russian', coalesce(NEW.ingredients_raw, ''));
  RETURN NEW;
END;
$$;

-- Перепрогон tsvector для существующих строк (батч через UPDATE без WHERE — медленный).
-- Делаем без WHERE — Postgres сам пройдётся по таблице.
-- На 7099 строк это занимает <5 секунд.
UPDATE public.global_products
SET name_tsvector =
      setweight(to_tsvector('russian', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('russian', coalesce(name_kz, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(name, '')), 'C'),
    brand_tsvector =
      to_tsvector('simple', coalesce(brand, '')),
    ingredients_tsvector =
      to_tsvector('russian', coalesce(ingredients_raw, ''));

-- ──────────────────────────────────────────────────────────────────────────
-- 7. GET_LOST_REVENUE — фикс расчёта для отсутствующих товаров
-- ──────────────────────────────────────────────────────────────────────────
-- Раньше: для товаров отсутствующих в каталоге price_kzt = NULL,
-- COALESCE(NULL, 0) = 0. Поэтому "lost revenue" учитывал только out_of_stock.
-- Теперь: для отсутствующих товаров используем медианную цену каталога магазина.

CREATE OR REPLACE FUNCTION public.get_lost_revenue(p_store_id uuid, p_days_back int)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_out_of_stock numeric := 0;
  v_not_in_catalog_count bigint := 0;
  v_median_price numeric := 0;
BEGIN
  -- Часть 1: товары out_of_stock (точная цена известна)
  SELECT COALESCE(SUM(sp.price_kzt), 0)
  INTO v_out_of_stock
  FROM scan_events se
  JOIN store_products sp
    ON sp.ean = se.ean
    AND sp.store_id = se.store_id
    AND sp.is_active = true
    AND sp.price_kzt > 0
    AND sp.stock_status = 'out_of_stock'
  WHERE se.store_id = p_store_id
    AND se.scanned_at >= NOW() - (p_days_back || ' days')::interval;

  -- Часть 2: товары отсутствующие в каталоге (count distinct EAN)
  SELECT COUNT(DISTINCT se2.ean)
  INTO v_not_in_catalog_count
  FROM scan_events se2
  LEFT JOIN store_products sp2
    ON sp2.ean = se2.ean AND sp2.store_id = se2.store_id AND sp2.is_active = true
  WHERE se2.store_id = p_store_id
    AND se2.scanned_at >= NOW() - (p_days_back || ' days')::interval
    AND sp2.id IS NULL;

  -- Медианная цена каталога магазина (fallback 1500 ₸ если каталог пустой)
  SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY price_kzt), 1500)
  INTO v_median_price
  FROM store_products
  WHERE store_id = p_store_id
    AND is_active = true
    AND price_kzt > 0;

  RETURN v_out_of_stock + (v_not_in_catalog_count * v_median_price);
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 8. VAULT_EMBEDDINGS — закрыть anon чтение (Data Moat защита)
-- ──────────────────────────────────────────────────────────────────────────
-- Раньше: anon мог читать vault_embeddings и вызывать match_vault_chunks
-- напрямую → утечка проверенных знаний Корсета (Е-добавки, халал-инфа).
-- Теперь: только service_role (через /api/ai с проверкой rate-limit).

DROP POLICY IF EXISTS "vault_read_anon" ON public.vault_embeddings;

REVOKE EXECUTE ON FUNCTION public.match_vault_chunks(vector, integer, jsonb) FROM anon;

-- /api/ai использует service_role клиент для match_vault_chunks (см. api/ai.js:71-76),
-- так что AI-чат продолжит работать. Закрытие anon только закрывает прямой доступ.

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- ПОСЛЕ APPLY: проверки (skip если опасаешься чужой DB)
--
-- 1. Atomic increments работают:
--    SELECT public.increment_cache_scan_count('1234567890123');
--    -- (вернёт void, но scan_count в external_product_cache увеличится на 1)
--
-- 2. Constraints применились:
--    SELECT conname FROM pg_constraint WHERE conrelid = 'public.users'::regclass;
--    -- Должно быть check_preferences_size, check_avatar_id_format, check_banner_url_format
--
-- 3. tsvector обновлён под russian:
--    SELECT name, name_tsvector FROM public.global_products LIMIT 1;
--    -- name_tsvector должен содержать стеммы (например, 'молок' для "молоко")
--
-- 4. profile-banners ограничены:
--    SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'profile-banners';
--    -- file_size_limit должен быть 2097152
-- ═══════════════════════════════════════════════════════════════════════════
