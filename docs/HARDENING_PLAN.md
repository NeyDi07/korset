# Körset — Hardening Plan (5 этапов)

> Создан: 2026-04-28 на основе `AUDIT_2026-04-28.md`.
> Горизонт: 50 магазинов × 10k сканов/день (~6M/год).
> Приоритет: безопасность → фундамент БД → тесты/CI → офлайн/RBAC → рефакторинг.
> Параллельно с визуалом — НЕТ. Сначала это, потом визуал. (Можно работать с другими AI-агентами параллельно ВНУТРИ этапа, но не пропускать этапы.)

---

## Логика разбивки

Этапы упорядочены по принципу:

1. **Сначала чинить exploit'ы** — ничего важного не запускать в публику с открытыми дырами.
2. **Потом фундамент БД** — индексы, RPC, триггеры — без которых через 3 месяца под нагрузкой всё ляжет.
3. **Потом тесты + CI** — чтобы не сломать обратно то, что починили.
4. **Потом офлайн + RBAC** — операционная корректность скан-метрик и Retail Cabinet.
5. **Потом рефакторинг + чистка** — фундамент для визуала и роста кода.

Каждый этап **самодостаточен**: после него продукт в рабочем состоянии, можно остановиться, выпустить, или перейти к визуалу.

---

# 🔴 ЭТАП 1 — Безопасность (БЛОКЕРЫ, 1.5–2 дня)

> **Цель:** закрыть 10 критичных дыр, после которых проект нельзя показывать публично.
> **После этапа:** RLS не пробивается, API защищены, error-leak нет, dev/prod конфиг едины.

## Задачи (в порядке выполнения)

### 1.1 RBAC для `api/ean-recovery.js` 🔴

- Создать миграцию **`017_admin_role.sql`**:
  - `ALTER TABLE users ADD COLUMN is_admin boolean DEFAULT false NOT NULL`.
  - RPC `is_user_admin(p_auth_id uuid) RETURNS boolean SECURITY DEFINER SET search_path = public`.
  - Обновить `users` для одного юзера — `UPDATE users SET is_admin = true WHERE auth_id = '<твой-auth_id>'` (вручную в SQL Editor).
- В `@/c:\projects\korset\api\ean-recovery.js` после `verifyJWT` добавить проверку `is_admin`. Если нет — 403.
- **Тест:** залогиненный не-админ → 403, админ → 200.

### 1.2 RLS — закрыть `stores.plan/expires_at` от владельца 🔴

В миграции **`017`** также:

```sql
DROP POLICY IF EXISTS "stores_update_owner" ON public.stores;

CREATE POLICY "stores_update_owner_safe" ON public.stores
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_billing_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.role() != 'service_role' THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Billing columns can only be modified by service_role';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_stores_billing ON public.stores;
CREATE TRIGGER protect_stores_billing
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.protect_billing_columns();
```

### 1.3 RLS — `scan_events_insert_anon` через client_token 🔴

В миграции **`018_client_token.sql`**:

```sql
ALTER TABLE public.scan_events ADD COLUMN IF NOT EXISTS client_token uuid;
CREATE INDEX IF NOT EXISTS idx_scan_events_client_token ON public.scan_events (client_token, scanned_at DESC);

DROP POLICY IF EXISTS "scan_events_insert_anon" ON public.scan_events;
CREATE POLICY "scan_events_insert_anon_safe" ON public.scan_events
  FOR INSERT TO anon
  WITH CHECK (
    user_id IS NULL
    AND client_token IS NOT NULL
    AND ean ~ '^\d{8,14}$'
  );
```

В `@/c:\projects\korset\src\utils\offlineDB.js:208-223` (flushPendingScans rows mapping) добавить:
```js
client_token: getOrCreateClientToken(),
```

В `@/c:\projects\korset\src\utils\userIdentity.js` добавить:

```js
export function getOrCreateClientToken() {
  try {
    let token = localStorage.getItem('korset_client_token')
    if (!token) {
      token = crypto.randomUUID()
      localStorage.setItem('korset_client_token', token)
    }
    return token
  } catch {
    if (!globalThis.__korset_client_token) globalThis.__korset_client_token = crypto.randomUUID()
    return globalThis.__korset_client_token
  }
}
```

В `@/c:\projects\korset\src\domain\product\resolver.js:296-345` (logScan) — добавить `client_token`.

### 1.4 RLS — `missing_products_insert_anon` 🟠

В миграции **`017`**:

```sql
DROP POLICY IF EXISTS "missing_products_insert_anon" ON public.missing_products;
CREATE POLICY "missing_products_insert_anon_safe" ON public.missing_products
  FOR INSERT TO anon
  WITH CHECK (
    store_id IS NOT NULL
    AND ean ~ '^\d{8,14}$'
  );
```

### 1.5 `api/ean-search.js` — JWT + rate-limit 🔴

- В `@/c:\projects\korset\api\ean-search.js` добавить `verifyJWT` (как в `delete-user.js`).
- Rate-limit временно в `Map()` (плохо, но лучше чем 0). В Этапе 3 заменим на Upstash.
- Лог запросов через `console.log({ ean, user: user.id })`.

### 1.6 `xlsx` CVE — миграция 🔴

- `npm uninstall xlsx`
- `npm install exceljs` (~600KB, активно поддерживается).
- Переписать `@/c:\projects\korset\src\utils\retailImport.js:67-82` под exceljs API.
- Тест: загрузить тестовый XLSX → проверить, что парсится корректно.

### 1.7 `vite.config.js` — убрать дублирующий `localApiPlugin` 🔴

- Удалить функцию `localApiPlugin` (`@/c:\projects\korset\vite.config.js:8-145`).
- Заменить на vite-плагин который проксирует `/api/*` на `vercel dev` процесс.
- Альтернатива: в `package.json` добавить script `"dev": "concurrently 'vercel dev --listen 3000' 'vite --port 5173'"` + Vite proxy `/api → :3000`.
- Это убирает дубль и заставляет dev/prod вести себя одинаково.

### 1.8 `/api/*` — sanitize error.message 🟠

В `@/c:\projects\korset\api\ai.js`, `delete-user.js`, `ean-recovery.js`, `ean-search.js`, `push/send-event.js` заменить:
- `return res.status(500).json({ error: e.message || 'Internal error' })`
- на:
  ```js
  console.error('[handler-name]', e)
  return res.status(500).json({ error: 'internal' })
  ```

### 1.9 `/api/ai` — валидация messages + санитизация product 🟠

В `@/c:\projects\korset\api\ai.js`:

```js
function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) return null
  let totalSize = 0
  for (const m of messages) {
    if (!m || typeof m !== 'object') return null
    if (m.role !== 'user' && m.role !== 'assistant') return null
    if (typeof m.content !== 'string' || m.content.length > 4000) return null
    totalSize += m.content.length
    if (totalSize > 16000) return null
  }
  return messages
}

function sanitizeProductForPrompt(p) {
  if (!p) return null
  const clean = (s) => typeof s === 'string' ? s.replace(/[\r\n]+/g, ' ').slice(0, 200) : ''
  return {
    name: clean(p.name),
    brand: clean(p.brand),
    ingredients: typeof p.ingredients === 'string' ? p.ingredients.replace(/[\r\n]+/g, ' ').slice(0, 1000) : '',
    halalStatus: ['yes','no','unknown'].includes(p.halalStatus) ? p.halalStatus : 'unknown',
    allergens: Array.isArray(p.allergens) ? p.allergens.slice(0, 20).filter(a => typeof a === 'string').map(a => a.slice(0, 50)) : [],
    nutrition: p.nutrition && typeof p.nutrition === 'object' ? p.nutrition : null,
    nutritionPer100: p.nutritionPer100 && typeof p.nutritionPer100 === 'object' ? p.nutritionPer100 : null,
  }
}
```

Применить перед передачей в `buildProductPrompt` / `buildComparePrompt`.

### 1.10 `/api/off` — создать (или удалить вызов) 🔴

Вариант A (рекомендую): создать `@/c:\projects\korset\api\off.js`:

```js
const ALLOWED_HOSTS = ['world.openfoodfacts.org', 'world.openfoodfacts.net']

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://korset.app')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  const ean = String(req.query.ean || '').replace(/\D/g, '').slice(0, 14)
  if (!ean || ean.length < 8) return res.status(400).json({ error: 'invalid_ean' })

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${ean}.json`
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return res.status(r.status).json({ error: 'off_error' })
    const data = await r.json()
    return res.status(200).json(data)
  } catch (e) {
    console.error('[/api/off]', e)
    return res.status(500).json({ error: 'internal' })
  }
}
```

Вариант B: если OFF не нужен — удалить `fetchFromOFFViaProxy` в resolver.

## Деливераблы Этапа 1

- ✅ Миграции `017_admin_role.sql`, `018_client_token.sql` применены.
- ✅ Все 5 API файлов с auth+sanitize+rate-limit.
- ✅ `xlsx` заменён на `exceljs`.
- ✅ `vite.config.js` без дублирующего AI-плагина.
- ✅ `/api/off` создан или вызов удалён.
- ✅ Прогон: `npm run build` без ошибок, `npm run lint` чистый.

---

# 🟠 ЭТАП 2 — Фундамент БД (1–1.5 дня)

> **Цель:** правильные индексы под RLS, atomic increments, валидация, cleanup.
> **После этапа:** БД готова к 50 магазинам × 10k сканов/день без перекрашивания таблиц.

## Задачи

### 2.1 Миграция `019_db_foundation.sql` — индексы, search_path, increments

```sql
-- 1. Critical missing index
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_id ON public.users (auth_id);

-- 2. SECURITY DEFINER search_path fixes (8 функций)
ALTER FUNCTION public.is_store_owner(public.stores) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_store_owner_by_id(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_vault_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.match_vault_chunks(vector, integer, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_data_quality_score() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_product_tsvector() SET search_path = public, pg_temp;
ALTER FUNCTION public.bulk_update_store_products(uuid, text[], integer[], text[], text[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.stage_unknown_eans(uuid, text[], text[], integer[], text[], text[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.resolve_unknown_eans(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.calc_data_quality_score(public.global_products) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_top_scanned_products(uuid, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_missed_opportunities(uuid, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_unique_customers(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_lost_revenue(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_scan_coverage(uuid, integer) SET search_path = public, pg_temp;

-- 3. Atomic scan_count RPCs
CREATE OR REPLACE FUNCTION public.increment_cache_scan_count(p_ean text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.external_product_cache
  SET scan_count = COALESCE(scan_count, 0) + 1, updated_at = now()
  WHERE ean = p_ean;
$$;
GRANT EXECUTE ON FUNCTION public.increment_cache_scan_count(text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.increment_missing_scan_count(p_ean text, p_store_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.missing_products (ean, store_id, scan_count, first_seen_at, last_seen_at, resolved)
  VALUES (p_ean, p_store_id, 1, now(), now(), false)
  ON CONFLICT (store_id, ean)
  DO UPDATE SET scan_count = missing_products.scan_count + 1, last_seen_at = now();
END $$;
GRANT EXECUTE ON FUNCTION public.increment_missing_scan_count(text, uuid) TO authenticated, anon;

-- 4. Validation constraints
ALTER TABLE public.users ADD CONSTRAINT IF NOT EXISTS check_avatar_id_format
  CHECK (avatar_id IS NULL OR (length(avatar_id) <= 256 AND avatar_id ~ '^(av\d+|https?://[^\s]+)$'));
ALTER TABLE public.users ADD CONSTRAINT IF NOT EXISTS check_banner_url_format
  CHECK (banner_url IS NULL OR (length(banner_url) <= 512 AND banner_url ~ '^(preset:\w+|https?://[^\s]+)$'));
ALTER TABLE public.users ADD CONSTRAINT IF NOT EXISTS check_preferences_size
  CHECK (preferences IS NULL OR octet_length(preferences::text) < 16384);

ALTER TABLE public.global_products ADD CONSTRAINT IF NOT EXISTS check_alcohol_range
  CHECK (alcohol_100g IS NULL OR (alcohol_100g >= 0 AND alcohol_100g <= 100));
ALTER TABLE public.global_products ADD CONSTRAINT IF NOT EXISTS check_saturated_fat_range
  CHECK (saturated_fat_100g IS NULL OR (saturated_fat_100g >= 0 AND saturated_fat_100g <= 100));

-- 5. Storage profile-banners limits
UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp']
WHERE id = 'profile-banners';

-- 6. tsvector → russian config
DROP TRIGGER IF EXISTS set_product_tsvector ON public.global_products;
CREATE OR REPLACE FUNCTION public.update_product_tsvector()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.name_tsvector :=
    setweight(to_tsvector('russian', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(NEW.name_kz, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'C');
  NEW.brand_tsvector := to_tsvector('simple', coalesce(NEW.brand, ''));
  NEW.ingredients_tsvector := to_tsvector('russian', coalesce(NEW.ingredients_raw, ''));
  RETURN NEW;
END $$;
CREATE TRIGGER set_product_tsvector
  BEFORE INSERT OR UPDATE OF name, name_kz, brand, ingredients_raw ON public.global_products
  FOR EACH ROW EXECUTE FUNCTION public.update_product_tsvector();
-- Reindex
UPDATE public.global_products SET name = name WHERE id IN (SELECT id FROM public.global_products LIMIT 1);
-- (триггер на UPDATE name пересоздаст tsvector — массовый перепрогон через batches см. отдельно)
```

### 2.2 Миграция `020_atomic_apply_import.sql` — транзакция импорта

Объединить `bulk_update_store_products` + `stage_unknown_eans` в один RPC `apply_retail_import_v2(...)` который делает обе операции в одной транзакции (либо обе успешны, либо обе откатываются).

### 2.3 Миграция `021_cleanup_cron.sql` — pg_cron очистка

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Cleanup external_product_cache expired
SELECT cron.schedule(
  'cleanup-cache-expired', '0 3 * * *',
  $$DELETE FROM public.external_product_cache WHERE ttl_expires_at < now() - interval '7 days'$$
);

-- Cleanup unknown_ean_staging resolved
SELECT cron.schedule(
  'cleanup-staging-resolved', '0 3 * * *',
  $$DELETE FROM public.unknown_ean_staging WHERE status = 'resolved' AND updated_at < now() - interval '30 days'$$
);

-- Cleanup notification_events old
SELECT cron.schedule(
  'cleanup-notifications-old', '0 4 * * *',
  $$DELETE FROM public.notification_events WHERE created_at < now() - interval '30 days'$$
);

-- Cleanup import_batches old
SELECT cron.schedule(
  'cleanup-imports-old', '0 4 * * *',
  $$DELETE FROM public.import_batches WHERE applied_at < now() - interval '90 days'$$
);
```

### 2.4 Миграция `022_audit_log.sql` — простой audit

```sql
CREATE TABLE public.audit_log (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  row_id text NOT NULL,
  op text NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_log_table_row ON public.audit_log (table_name, row_id, changed_at DESC);
CREATE INDEX idx_audit_log_changed_by ON public.audit_log (changed_by, changed_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
-- Read only by service_role and admins (via RPC)

CREATE OR REPLACE FUNCTION public.audit_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.audit_log (table_name, row_id, op, old_data, new_data, changed_by)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER audit_stores AFTER INSERT OR UPDATE OR DELETE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_store_products AFTER UPDATE OR DELETE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
```

### 2.5 Миграция `023_get_lost_revenue_fix.sql`

Переписать `get_lost_revenue` — для отсутствующих в каталоге товаров использовать median price из похожих товаров.

### 2.6 Миграция `024_fix_notification_meta.sql`

Привести `meta` в `notification_events` к структуре `{ store_id: uuid, ... }`. Обновить `api/push/send-event.js` чтобы писал `store_id` (резолвить из `storeSlug`).

### 2.7 Серверный `external_product_cache` write

Создать `@/c:\projects\korset\api\cache-product.js` (через service_role) — `POST /api/cache-product { ean, source, normalized... }`. Обновить `@/c:\projects\korset\src\domain\product\resolver.js:236-266` — вызывать этот эндпоинт вместо прямого upsert.

### 2.8 Vault RAG — закрыть anon чтение/RPC

```sql
DROP POLICY IF EXISTS "vault_read_anon" ON public.vault_embeddings;
REVOKE EXECUTE ON FUNCTION public.match_vault_chunks FROM anon;
```

`/api/ai` использует service_role для match_vault_chunks — это уже так работает.

## Деливераблы Этапа 2

- ✅ Миграции 019-024 применены.
- ✅ `/api/cache-product.js` создан, resolver использует.
- ✅ `client_token` пишется во все scan_events (через изменения этапа 1).
- ✅ Smoke-тест: дашборд `RetailDashboardScreen` рендерится за <500ms (после индексов).

---

# 🟢 ЭТАП 3 — Тесты + CI + наблюдаемость (1 день)

> **Цель:** автоматизированная защита от регрессов.
> **После этапа:** PR не может зайти в main с красным CI.

## Задачи

### 3.1 Юнит-тесты `fitCheck.js` (30 кейсов)

Создать `tests/unit/fitCheck.test.mjs` с 30 кейсами по матрице из `AUDIT_2026-04-28.md` 5.2.

Структура:
- `describe('Red severity')` — аллергены × 8
- `describe('Orange severity')` — traces × 5
- `describe('Yellow severity')` — halal/diet × 10
- `describe('Edge cases')` — empty/null/multilang × 5
- `describe('Severity hierarchy')` — red > orange > yellow > safe × 2

Запускать через `node --test tests/unit/*.test.mjs` (Node 20 native).

### 3.2 ESLint строже

Обновить `@/c:\projects\korset\eslint.config.js`:

```js
rules: {
  ...reactHooks.configs.recommended.rules,
  'react-hooks/exhaustive-deps': 'error', // ← было НЕТ
  'react-hooks/rules-of-hooks': 'error',
  'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-undef': 'error', // ← было 'warn'
  'no-console': 'off',
}
```

Прогнать `npm run lint:fix`. Починить, что отвалилось.

### 3.3 GitHub Actions CI

Создать `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci --legacy-peer-deps
      - run: npm run lint
      - run: npm run build
      - run: node --test tests/unit/*.test.mjs
```

### 3.4 Sentry free tier

- Завести аккаунт на https://sentry.io (free 5k events/мес).
- `npm install @sentry/react @sentry/vite-plugin`.
- В `@/c:\projects\korset\src\main.jsx` добавить инициализацию.
- В `@/c:\projects\korset\src\components\ErrorBoundary.jsx` отправлять ошибки в Sentry.
- В `api/*.js` (Node-side) — `@sentry/node`.

### 3.5 `/api/health` эндпоинт

Создать `@/c:\projects\korset\api\health.js`:

```js
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const checks = { api: 'ok', supabase: 'unknown', migrations: 'unknown' }
  try {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    const { error } = await sb.from('stores').select('id').limit(1)
    checks.supabase = error ? `error: ${error.code}` : 'ok'
  } catch { checks.supabase = 'error' }

  // Migration drift check (минимальный):
  try {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { error } = await sb.from('users').select('avatar_id').limit(1) // migration 016
    checks.migrations = error ? `missing: 016` : 'ok'
  } catch { checks.migrations = 'unknown' }

  const ok = checks.supabase === 'ok' && checks.migrations === 'ok'
  return res.status(ok ? 200 : 503).json(checks)
}
```

### 3.6 Husky pre-commit — добавить тесты

`@/c:\projects\korset\.husky\pre-commit`:
```
npx lint-staged
node --test tests/unit/*.test.mjs
```

### 3.7 Migration framework через Supabase CLI

- `npm install -g supabase` (или `npx`).
- `supabase init` (создаёт `supabase/config.toml`).
- `supabase link --project-ref <ref>` — связать с production.
- `supabase db pull` — стянуть текущую схему.
- `supabase db diff -f 025_baseline` — зафиксировать дрифт.
- В CI добавить `supabase db lint` для проверки миграций.

## Деливераблы Этапа 3

- ✅ `tests/unit/fitCheck.test.mjs` зелёный, 30+ тестов.
- ✅ ESLint `exhaustive-deps: error`, проект чист.
- ✅ GitHub Actions работает на push/PR.
- ✅ Sentry показывает события.
- ✅ `/api/health` возвращает 200.

---

# 🔵 ЭТАП 4 — Офлайн + Сканы + RBAC (1 день)

> **Цель:** офлайн работает корректно, метрики не теряются, кабинет защищён.

## Задачи

### 4.1 `offlineDB` — DB_VERSION migration framework

`@/c:\projects\korset\src\utils\offlineDB.js`:
- `DB_VERSION = 2` + явный `upgrade(db, oldVersion, newVersion, tx)` с case-by-case.
- Добавить object-store `meta` поле `schemaVersion` для контроля.

### 4.2 `offlineDB` — flush per-row при ошибке batch

В `flushPendingScans` (`@/c:\projects\korset\src\utils\offlineDB.js:203-243`): если batch insert падает — переключиться на single-row.

### 4.3 `offlineDB` — переключение магазина без потери

Изменить keyPath с `ean` на составной: `[store_id, ean]` (или раздельные object stores per store).

### 4.4 Service Worker — Background Sync напрямую

В `@/c:\projects\korset\src\sw.js:89-100`:
- При `sync` событии — открыть IDB, прочитать pending, POST на Supabase REST API напрямую (через `fetch + Authorization: Bearer <anon>`).
- Если приложение открыто — оставить текущий путь через postMessage.

### 4.5 SW — убрать /api/* из NetworkFirst кэша

В `@/c:\projects\korset\src\sw.js:9-21`: либо полностью убрать `registerRoute` для `/api/*`, либо явно `cacheKeyWillBeUsed: () => null` (никогда не кэшировать).

### 4.6 RBAC — `is_admin` через `app_metadata`

- Использовать миграцию 017 (этап 1.1) `users.is_admin` как источник истины.
- `@/c:\projects\korset\src\layouts\RetailLayout.jsx:95` — заменить на async-проверку через `users` таблицу:

```jsx
const [isAdmin, setIsAdmin] = useState(false)
useEffect(() => {
  if (!user) return
  supabase.from('users').select('is_admin').eq('auth_id', user.id).maybeSingle()
    .then(({ data }) => setIsAdmin(data?.is_admin === true))
}, [user])
```

### 4.7 RBAC — гард на `currentStore=null`

`@/c:\projects\korset\src\layouts\RetailLayout.jsx:96` — добавить:

```jsx
if (!currentStore) return <RetailLoader /> // или NoAccessScreen если store не найден после load
```

### 4.8 AuthContext — retry на race

`@/c:\projects\korset\src\contexts\AuthContext.jsx:56-78`: при ошибке UPSERT (UNIQUE) — повторить SELECT.

### 4.9 UserDataContext — count: 'estimated'

`@/c:\projects\korset\src\contexts\UserDataContext.jsx:54-60` — заменить `'exact'` на `'estimated'` (после фикса 2.1 индекс ускорит, но estimated даёт O(1) всегда).

### 4.10 OfflineContext — BroadcastChannel master-tab

`@/c:\projects\korset\src\contexts\OfflineContext.jsx:46-54`: заменить per-tab `setInterval` на master-tab координацию через BroadcastChannel.

## Деливераблы Этапа 4

- ✅ Background Sync работает в фоне (без открытого приложения).
- ✅ Переключение магазинов сохраняет кэш.
- ✅ Один кривой скан не убивает batch.
- ✅ `is_admin` через server-side, не через user_metadata.
- ✅ Множественные вкладки не дублируют polling.

---

# 🟣 ЭТАП 5 — Рефакторинг + чистка (2–3 дня)

> **Цель:** чистый каркас под визуал. Без него любой редизайн утонет в монолитах.

## Задачи

### 5.1 Удалить `UnifiedProductScreen.jsx` (мёртвый код)

Не используется в роутах. Удалить.

### 5.2 Решить судьбу `ProductScreen` vs `ExternalProductScreen`

- Изучить overlap между ними.
- Вариант: единый компонент с пропом `external: boolean`.
- Альтернатива: оставить как есть, но вынести общие куски в `src/components/product/`.

### 5.3 Разрезать ProductScreen.jsx (45KB)

Цель: основной файл ≤ 8KB. Вынести в `src/components/product/`:
- `ProductHero.jsx` (изображение + название + цена)
- `ProductSpecs.jsx` (характеристики)
- `ProductNutrition.jsx` (КБЖУ + Nutri-Score)
- `ProductFitBadge.jsx` (Fit-Check резюме)
- `ProductActions.jsx` (Избранное, Сравнить, AI-чат)
- `ProductAlternatives.jsx`
- `ProductSourceBadge.jsx` (Data Moat confidence!)

### 5.4 Разрезать ProfileScreen.jsx (63KB)

- `ProfileHeader.jsx` (баннер + аватар + ник)
- `ProfileStats.jsx` (счётчики сканов/избранного)
- `ProfileMenuLinks.jsx` (настройки/уведомления/etc.)
- `ProfileGuestCTA.jsx` (приглашение залогиниться)
- `ProfileRetailEntry.jsx` (только для owner_id)

### 5.5 Разрезать HomeScreen.jsx (60KB)

- `HomeHero.jsx`
- `HomeStories.jsx`
- `HomeQuickActions.jsx`
- `HomeRecentScans.jsx`

### 5.6 Lazy-loading маршрутов

`@/c:\projects\korset\src\App.jsx`: все экраны через `React.lazy()`. Группировка по роли: customer / retail / auth / public.

```jsx
const RetailDashboardScreen = lazy(() => import('./screens/RetailDashboardScreen.jsx'))
// ...
<Suspense fallback={<RetailLoader />}>
  <Routes>...</Routes>
</Suspense>
```

**Замечание:** в audit-full отмечено, что lazy уже откатили из-за «задержки при переходах». Решение: lazy + **prefetch** на BottomNav hover/focus + persistent loading-screen без мигания.

### 5.7 `xlsx` (теперь exceljs) — lazy import

`@/c:\projects\korset\src\utils\retailImport.js:28,75`: `await import('exceljs')` уже динамика — оставить.

### 5.8 Mock-экраны DEV-only

`@/c:\projects\korset\src\App.jsx:35,119`:
```jsx
{import.meta.env.DEV && <Route path="/_mock/product" element={<ProductMockScreen />} />}
```

И импорт через `if (import.meta.env.DEV) { ProductMockScreen = (await import(...)).default }`.

### 5.9 i18n.js (97KB) разбить по неймспейсам

Создать:
- `src/locales/ru/common.js`, `product.js`, `profile.js`, `retail.js`, `auth.js`
- `src/locales/kz/...`
- `src/utils/i18n.js` — провайдер с lazy-load неймспейса.

### 5.10 `products.json` — lazy или удалить

`@/c:\projects\korset\src\domain\product\resolver.js:1`: `await import('../../data/products.json')` только в demo-функциях. Если не нужен — удалить вообще.

### 5.11 Чистка корня репо

- `vite.config.js.timestamp-*.mjs` (3 шт) → удалить + добавить в .gitignore.
- `nlm_out.txt`, `nlm_out_utf8.txt` → удалить.
- `insert_products.sql` → переместить в `scripts/archive/` или удалить.
- `generate_sql.cjs`, `sync_products_db.mjs`, `update_products_meta.mjs` → `scripts/archive/`.
- `KORSET_ULTIMATE.md` → `docs/`.

### 5.12 `scripts/` структуризация

```
scripts/
  active/   ← регулярно используемые (arbuz-catalog-parser, npc-enrich, korzinavdom-parser, embed-vault, ...)
  archive/  ← одноразовые миграции данных
  dev/      ← локальные хелперы
  utils/    ← shared (r2-upload.cjs)
```

Файлы с префиксом `_` — переместить в `archive/` (это уже их роль).

### 5.13 `netlify.toml` удалить (1.1)

### 5.14 `.gitignore` доработка

Добавить:
```
vite.config.*.timestamp-*.mjs
coverage/
playwright-report/
*.log
.idea/
.cursor/
```

`data/` — уточнить через `data/raw/`, `data/exports/` (если `products.json` там лежит — переместить или сделать исключение).

### 5.15 Legacy роуты удалить

`@/c:\projects\korset\src\App.jsx:135-143`: удалить 9 redirect'ов. Вместо них один wildcard `*` уже есть.

### 5.16 fitCheck — word-boundary regex

`@/c:\projects\korset\src\utils\fitCheck.js:75-95,99-109`: заменить `String.includes` на regex `\\b<word>\\b` или токенизацию `[\s,;.()]`. Тесты из этапа 3 покроют.

### 5.17 Data Moat UI бейдж

В `src/components/product/ProductSourceBadge.jsx`: рендер по `product.sourceMeta.sourceConfidence` или `qualityScore`:
- ≥80 — зелёный «Проверенные данные»
- 50-79 — жёлтый «Предварительно»
- <50 или `aiEnriched` — оранжевый «AI-предположение»

В `ProductScreen` вставить под названием товара. И при `<80 + halal AI-enriched` — скрыть халал-бейдж или маркировать «не подтверждено».

### 5.18 ErrorBoundary стилизованный

`@/c:\projects\korset\src\components\ErrorBoundary.jsx`: премиум fallback в стиле бренда (тёмный glass + кнопка перезагрузки).

### 5.19 nameKz в ProductScreen

После рефакторинга — добавить логику `lang === 'kz' && product.nameKz ? product.nameKz : product.name`.

### 5.20 formatCacheAge через i18n

`@/c:\projects\korset\src\contexts\OfflineContext.jsx:72-82`: «только что», «мин назад» — через `useI18n`.

### 5.21 retailImport fallback safety

`@/c:\projects\korset\src\utils\retailImport.js:137`: `if (!product) return { ok: false, ... }`.

## Деливераблы Этапа 5

- ✅ Ни один экран ≥ 15KB.
- ✅ `src/components/{product,profile,home}/` структурированы.
- ✅ Initial bundle ≤ 600KB JS (gzip).
- ✅ Корень репо чистый.
- ✅ Scripts/ структурирован.
- ✅ Data Moat UI работает.
- ✅ KZ-локализация полная.

---

# 🎁 ЭТАП 6 (опционально, после пилота) — Полировка

Все 🟢 LOW + некритичные 🟡 MEDIUM, которые улучшают UX и DX, но не блокируют пилот:

- 1.7 Self-host шрифтов
- 1.9 CSP в Vercel headers
- 1.11 Полный PWA manifest (iOS иконки, maskable, shortcuts)
- 1.18 Security headers (HSTS, X-Frame-Options и т.д.)
- 4.6 BroadcastChannel polish (если не сделано в этапе 4)
- 5.25 ProfileContext realtime подписка
- 5.27 Преобразование inline styles → CSS-modules
- 8.3 html5-qrcode → @zxing/browser
- 8.6 aws-sdk → aws4fetch
- 8.4 framer-motion → CSS transitions
- 2.14 Расширенный audit-log (помимо stores/store_products)
- 6.5 profile_setup_done → public.users
- Полная интернационализация (KZ stemming через unaccent, и т.д.)
- Партицирование scan_events (когда таблица перевалит за 10M строк)

---

# 📅 Календарь (рекомендация при работе соло + AI-помощники параллельно)

| День | Этап | Что готово |
|---|---|---|
| 1 | 1 (1/2) | Миграции 017-018, ean-recovery RBAC, ean-search auth, error-leak |
| 2 | 1 (2/2) | xlsx→exceljs, vite.config, /api/off, /api/ai валидация |
| 3 | 2 | Миграции 019-024, /api/cache-product, vault closed |
| 4 | 3 | Тесты fitCheck, CI, Sentry, /api/health, supabase CLI |
| 5 | 4 | offlineDB v2, SW Background Sync, RBAC isAdmin, retry race |
| 6 | 5 (1/3) | F1-F2: дубли продуктов, ProductScreen разрезка |
| 7 | 5 (2/3) | F3-F4: ProfileScreen, HomeScreen разрезка |
| 8 | 5 (3/3) | Lazy-routes, mock-only-dev, i18n split, чистка корня |
| 9 | 5 финал | Data Moat UI, fitCheck word-boundary, ErrorBoundary, nameKz |
| 10 | Буфер | Прогон всего, smoke-тест, готов к визуалу |

---

# 🚦 Готовность к визуалу

После Этапа 5 продукт **готов к визуальному редизайну**:
- Безопасный.
- БД масштабируется до 50 магазинов × 10k сканов/день.
- Покрыт юр.чувствительными тестами.
- Офлайн работает корректно.
- Каркас компонентов чистый.
- CI блокирует регрессы.

Этап 6 можно делать **параллельно с визуалом** или после пилота.
