# KÖRSET — БЫСТРЫЙ КОНТЕКСТ

> Для ИИ-ассистента. Единственный файл для ручной загрузки в начале чата.
> Глубокая архитектура → `ARCHITECTURE.md`. Аудит → `docs/vault/plans/audit-full.md`. Правила → `AGENTS.md`.

---

## Что такое Körset

Store-context AI assistant (mobile-first PWA) для офлайн-магазинов Казахстана.
Сканирует штрихкод → Fit-Check (аллергии, Халал, диеты). B2B2C: платят магазины (~15 000 тг/мес SaaS).

**Стек:** React 18 + Vite + Supabase (PostgreSQL, Auth, Storage) + Vercel Serverless + OpenAI
**Код:** JavaScript (не TypeScript), Vanilla CSS (не Tailwind)
**Стиль:** Dark/Light Premium Glassmorphism, Advent Pro + Inter, SVG иконки (Material Symbols опционально)

---

## Маршруты

```
/                           → Лендинг
/s/:storeSlug               → Главный экран магазина
/s/:storeSlug/scan          → Сканер
/s/:storeSlug/catalog       → Каталог
/s/:storeSlug/product/:ean  → Карточка товара
/s/:storeSlug/history       → История
/s/:storeSlug/profile       → Профиль
/s/:storeSlug/profile/edit  → Редактирование профиля (аватар, баннер, ник)
/s/:storeSlug/account       → Личные данные (email, пароль, ID)
/retail/:storeSlug/...      → Retail Cabinet
```

---

## Что работает

- Supabase Auth (Google OAuth), онбординг 2-шаговый
- Сканер штрихкодов, AIScreen (чат с ИИ + RAG)
- Fit-Check (Red/Orange — детерминированный, Yellow — AI)
- Push-уведомления, История + Избранное, Smart Merge
- Retail Cabinet: Dashboard (тенге метрики), Products (inline edit, barcode search), Import (CSV/XLS/XLSX + unknown EAN staging), Settings (лого, контакты, QR), EAN Recovery (serverless API)
- CompareScreen: двухэтапный scan flow, multi-factor scoring, dynamic rows, AI commentary
- Офлайн: App Shell + IndexedDB каталог + очередь сканов + OfflineBanner
- RAG через Supabase pgvector
- RLS на 13 таблицах, JWT auth на API
- Светлая + тёмная тема (3 этапа завершены, semantic tokens на всём UI)
- Профиль: баннер + аватар + редактирование (ProfileEditScreen)
- Личные данные: AccountScreen — email, дата регистрации, смена пароля, выход, удаление аккаунта (с confirm modal), статус владельца магазина
- ProfileScreen: тема-зависимые цвета (name pill, guest banner), Retail Cabinet только для owner_id
- Footer: v1.0.0 + SVG флаг Казахстана (без эмодзи)
- Каталог: Virtuoso виртуализация + двухэтапная загрузка + light поля

---

## Железные правила (кратко)

0. **Vault Protocol:** НАЧАЛО чата → прочитай CONTEXT.md. КОНЕЦ чата → сохрани в Vault + embed. → `AGENTS.md`
1. Сначала анализ → потом код. Предложи план → получи апрув.
2. Не ломать работающее.
3. Смотри шире — проверяй связи (.gitignore, i18n, vault, контекст, импорты, side effects).
4. Экраны покупателя → только внутри `/s/:storeSlug/`.
5. Иконки: Качественные SVG для премиального вида. Material Symbols — опционально.
6. Аватары только `<ProfileAvatar />`.
7. **Тёмная + светлая тема — обе поддерживаются.** Только CSS-переменные, НЕ хардкодить цвета.
8. Новый текст → через `useI18n` (RU/KZ обязательно).
9. Оценивай через B2B: «Помогает ли это продать подписку?»
10. Не менять дизайн без разрешения владельца.
11. НЕ делать ручной деплой `vercel --prod`.

---

## АКТУАЛЬНЫЕ СТАТИСТИКИ БД (2026-05-02)

- **7008 active** global_products, **1203 inactive**
- **18 категорий** (было 227 хаотичных значений), 0 некорректных категорий
- **category_raw/subcategory_raw** — оригинальные значения сохранены для аудита
- **name_raw** — оригинальные имена сохранены перед нормализацией (миграция 025 ✅)
- **Колонка `ingredients`** — удалена, теперь `ingredients_raw` + `ingredients_kz`
- **Реальные EAN: 6980** (99.1%), **Fake EAN: 66** (0.9% — реальные продукты без штрихкода)
- **store_products active: 6867** (1 магазин MARS, 141 gp ещё не завезены)
- **EAN совпадение: 100%** (0 mismatches, 0 сирот)
- **Состав: ~88%** (6139 из 7008 имеют ingredients_raw)
- **R2 CDN: 99.96%** продуктов с картинками на cdn.korset.app
- **Названия нормализованы: 5352/7008** — sentence case, packaging suffixes removed, weight/% formatted
- **name_kz: 7008/7008** (100%) — 89% качество (65% со специфичными KZ буквами + 24% чистый KZ)
- **useLocalName** — все экраны показывают nameKz при lang=kz (был только CatalogScreen)
- **packaging_type: 195** (can 50, pouch 68, bottle_glass 38, bottle_plastic 35, tub 4, tetrapak 0)
- **fat_percent: 680** (min 0.5%, max 82.5%)

---

## МИГРАЦИИ

| # | Назначение | Статус |
|---|-----------|--------|
| 001-016 | Базовые (RLS, pgvector, indexes, RPC, profile, R2, data_quality) | ✅ все применены |
| 017-021 | Security hardening, allergen normalization, app_metadata, admin trigger | ✅ применены |
| 022 | idx_users_auth_id (RLS perf) + category normalization | ✅ применена |
| 023 | Fix SECURITY DEFINER на analytics views | ✅ применена |
| 024 | packaging_type + fat_percent + quality score (backfill: 964 updates) | ✅ применена |
| 025 | name_raw + price cleanup + batch_update_product_names RPC | ✅ применена |

---

## СКРИПТЫ PIPELINE (основные)

1. `scripts/arbuz-catalog-parser.cjs` — Arbuz-first bulk import (API+NPC+R2)
2. `scripts/arbuz-enrich.cjs` — обогащение через Arbuz
3. `scripts/npc-enrich.cjs` — NPC enrichment + `--fix-names`
4. `scripts/usda-enrich.cjs` — через Vercel proxy
5. `scripts/korzinavdom-parser.cjs` — Корзина дома
6. `scripts/npc-eans-harvest.cjs` — combo EAN harvest
7. `scripts/resolve-v3.cjs` — KZ-aware resolver + NPC name search
8. `scripts/resolve-unknown-eans.cjs` — серверный каскад (NPC → Arbuz → USDA → OFF)
9. `scripts/validate-ean.cjs`, `audit-catalog.cjs`, `add-category-prefix.cjs`
10. `scripts/migrate-images-to-r2.mjs`, `embed-vault.mjs`, `query-vault.mjs`
11. `scripts/translate-composition.cjs` — перевод состава через OpenAI
12. `scripts/backfill-quantity.mjs` — обновление quantityParsed в Supabase из name
13. `scripts/cleanup-nonfood.mjs` — деактивация non-food/pet_food, фикс garbage quantity
14. `scripts/sync-store-product-eans.mjs` — синхронизация fake→real EAN, деактивация дублей
15. `scripts/translate-names-kz.mjs` — массовый перевод name→name_kz через OpenAI (gpt-4o-mini, batch 10, ~$0.06)
16. `scripts/normalize-categories.mjs` — нормализация категорий (227→18)
17. `scripts/extract-attributes.mjs` — backfill упаковки/жирности/диет из названия (--dry-run/--live)
18. `scripts/normalize-names.mjs` — нормализация названий (sentence case, мусор, формат)
19. `src/domain/product/nameNormalizer.js` — центральная функция нормализации имён

---

## 🚨 АКТУАЛЬНЫЙ ПРИОРИТЕТ (2026-05-03)

**Аудит выполнен** (92 находки). **Этапы 1–4 ЗАКРЫТЫ ✅** (безопасность + DB + нормализация + KZ перевод).

### Статус этапов:

- ✅ **Этап 1** — Безопасность — ЗАКРЫТО
- ✅ **Этап 2** — DB фундамент — ЗАКРЫТО  
- ✅ **Этап 3** — Нормализация названий (5352/7008) — ЗАКРЫТО
- ✅ **Этап 4** — KZ перевод имён (90% качество) — ЗАКРЫТО
- ✅ **Этап 5** — i18n профессиональная миграция — ЗАВЕРШЕНО (0 lint errors, 4/4 e2e, 64 unit tests)
- 🟣 **Этап 6** — Рефакторинг монолитов (ProductScreen 1315 строк, ProfileScreen, HomeScreen)

### Monitoring (Production-ready)

- **Sentry** — фронтенд + бэкенд (`VITE_SENTRY_DSN` + `SENTRY_DSN` в Vercel)
- **Telegram alerts** — `api/sentry-webhook.js` + Sentry Internal Integration → мгновенные алерты
- **Rate limiting** — `/api/ai.js`, `/api/usda.js` (OFF removed)
- **Health check** — `/api/health`
- **Runbook** — `docs/vault/operations/monitoring-runbook.md`

**Общая оценка проекта:** ~80/100 (было ~50/100).

---

## ВЫПОЛНЕНО (ключевое)

- ✅ Light theme (3 этапа), EAN 99.1%, R2 CDN 99.96%, Состав 81%
- ✅ Retail: Dashboard(₸), Import(CSV/XLS), Products, Settings, EAN Recovery
- ✅ CompareScreen, Data Moat каскад, Quantity parser, Catalog Virtuoso+i18n+nameKz
- ✅ Security: RBAC, RLS, CVE-фиксы, fitCheck 35+ тестов, Sentry, Telegram alerts
- ✅ DB: 024 миграции, 18 категорий, packaging_type+fat_percent extraction, idx_users_auth_id
- ✅ Заморожено: визуал/Landing/Stories/биллинг — до первых продаж
- ✅ KZ перевод: 89% качество (было 72%), все экраны показывают nameKz при lang=kz
- ✅ i18n хардкод 5 экранов — ЗАВЕРШЕНО: ProductScreen, EanRecovery, ScanScreen, Alternatives, Compare — все `t.*` ключи
- ✅ i18n полная миграция — ЗАВЕРШЕНО (все 17 шагов):
  - `src/utils/i18n.js` (1950 строк) УДАЛЁН → `src/i18n/` (6 модулей: index, resolve, loader, plural, format, interpolate)
  - `src/locales/{ru,kz}/*.json` — 14 namespace × 2 lang = 28 JSON файлов (~1800 ключей)
  - `t.key` → `t('key')` — 468 автозамен в 39 файлах (AST-based скрипт)
  - 8 flagged namespace-only/array-method паттернов — ручной фикс (Proxy, collectArr)
  - 70+ inline `lang === 'kz' ? 'Қаз' : 'Рус'` → `t('key')` — все экраны
  - Старый i18n.js удалён, main chunk -56KB (-18KB gzip)
  - `lang === 'kz'` остатки: 13 — все корректные (data-driven, CSS, locale codes)
  - Новые locale namespace: auth.json, profile.json, history.json (RU+KZ)
  - Линт: **0 ошибок**, CatalogScreen deps фикс
  - **Проверено Playwright:** RU/KZ лендинг работает, переключение языка ОК, 0 console errors, 0 unresolved dot-keys
  - **E2e Landing:** 4/4 тестов проходят
  - **check-i18n:** 0 missing KZ, 0 orphan, 0 empty (109 identical — бренды/иконки/единицы, корректно)
  - **64 unit-теста:** resolve, plural, format, interpolate — все проходят
  - **`exists` API** — отдельная функция из `useI18n()`, не свойство `t`
  - **collectStrArr/collectObjArr** — принимают `(t, exists, prefix, ...)` — 16 вызовов в LandingScreen
  - **Proxy удалён** из RetailDashboardScreen + RetailProductsScreen → явный useMemo (26 + 30 ключей)
  - **ProfileStatsTabs.jsx** — 13 пропущенных `t.profile.xxx` → `t('profile.xxx')` исправлено
  - **0 dot-access остатков** — CLEAN
  - **main.jsx** — empty catch block → добавлен комментарий для no-empty lint
  - **RetailSettingsScreen** — 40 `isKz ? 'Қаз' : 'Рус'` → `t('retail.settings.*')` (38 новых ключей RU+KZ)
  - **StorePublicScreen** — 8 `isKz ? 'Қаз' : 'Рус'` → `t('home.store*')` (12 новых ключей RU+KZ)
  - **Мелочь:** UnifiedProductScreen (2), SetupProfileScreen (1), QRPrintScreen (2), RetailProductsScreen (1), ProfileScreen (3), AccountScreen (2) — все хардкод → t()
  - **Dev-mode warnings:** resolve.js → `⚠key` визуальная пометка в DEV при missing key
  - **PrivacyPolicyScreen** → markdown файлы `src/legal/privacy-{ru,kz}.md` + `markdownToHtml()` рендерилка, 0 хардкода в JSX
- ✅ i18n тесты + check скрипт — ЗАВЕРШЕНО:
  - `scripts/check-i18n.mjs` — 14 namespace, 0 missing KZ, 106 identical (бренды/иконки/единицы)
  - `tests/unit/i18n/` — 64 теста (plural 20, interpolate 13, format 16, resolve 15), все проходят
  - `resolve.js` — `import.meta.env?.DEV` (optional chaining для Node.js совместимости)
  - `useI18n()` возвращает `{ t, exists, lang, format }` — `exists` отдельный useCallback, не свойство `t`
  - **Dev-mode:** `resolve()` возвращает `⚠key` при missing key для визуальной отладки
  - **PrivacyPolicyScreen:** markdown `src/legal/privacy-{ru,kz}.md` + `markdownToHtml()` конвертер

---

## КЛЮЧЕВЫЕ ПРОБЛЕМЫ НАЗВАНИЙ (анализ 7046 продуктов) — ДЛЯ ЭТАПА 3

| Проблема | Кол-во | Пример |
|----------|--------|--------|
| ALL CAPS | 934 | `ПЕЧЕНЬЕ G&G С ПРОСЛОЙКОЙ ШОКОЛАДА 500ГР` |
| Мусорные суффиксы упаковки | 126 | `КНВРТ`, `ТБА`, `С/Б`, `Ж/Б`, `П/Б`, `СТБ` |
| Очень длинные (>80 символов) | 243 | Название + NPC-мусор + дублированный вес |
| Бренд в поле, но не в названии | 593 | brand=ABC но `ДЕСЕРТ АВС...` |
| Двойной вес | 93 | `670г Бут.ТП8 ... 670гр` |
| Жирность % в названии | 590 | `КЕФИР FRESH HOUSE 2,5% 300ГР` |

---

## КАТЕГОРИИ — РЕШЕНО (18 категорий + ~85 подкатегорий)

18 ключей: dairy_eggs, meat, deli, fish, water_beverages, tea_coffee, sweets, snacks, grocery, sauces_spices, bread, frozen, fruits_veg, baby_food, ready_meals, healthy, personal_care, household
Маппинг: `src/domain/product/categoryMap.js` → normalizeCategory()
Pipeline: arbuz-import, arbuz-catalog-parser, korzinavdom-parser — все используют normalizeCategory()

---

## АТРИБУТЫ ПРОДУКТОВ — EXTRACTION RULES

| Атрибут | Источник | Хранение | Ожидаемое кол-во |
|---------|----------|----------|-------------------|
| packaging_type | Суффиксы (КНВРТ, ТБА, Ж/Б, П/Б, ПЭТ, СТБ) | `packaging_type text` CHECK 6 типов | 195 applied |
| fat_percent | Цифра+`%` в названии + category hint | `fat_percent numeric(4,1)` | 680 applied |
| diet_tags | Ключевые слова | `diet_tags_json` (append) | ~94 applied |
| halal_status | HALAL/ХАЛЯЛЬ в названии | `halal_status` (upgrade unknown→yes) | ~10 |

6 типов упаковки: bottle_plastic, bottle_glass, can, tetrapak, pouch, tub
12 diet-тегов (после аудита): sugar_free, gluten_free, lactose_free, vegan, vegetarian, fitness, organic, kosher, diabetic, low_calorie, low_fat, enriched

---

## ТЕКУЩИЙ ФОКУС (2026-05-02)

### Оптимизация сканирования — ЗАВЕРШЕНО ✅ (включая Сессию 4 — OFF removal)

**Сессия 1** (resolver.js + migration 026):
1. Fire-and-forget логирование — ~150-300ms экономии per scan
2. Session EAN cache `_eanCache` TTL 5 мин — повторные сканы **< 1ms**
3. RPC `fn_resolve_product_by_ean` — 1 DB round-trip вместо 2-4
4. Миграция 026 — применена вручную через Supabase SQL Editor ✅

**Сессия 2** (прогрев + логика):
1. Pre-warm `html5-qrcode` в `HomeScreen.jsx` (useEffect) — camera opens ~500ms faster
2. `notifyCatalogWarmed(storeId)` в `StoreContext` + fast-path в `resolver.js` — после warmup IndexedDB все сканы **< 5ms**
3. Параллельный `Promise.all([lookupProduct, stopScanner])` в `ScanScreen` — ~100ms экономии
4. FPS 20→25 в ScanScreen

**Сессия 3** (UX / оптимистичная навигация):
1. `ScanScreen` нормальный режим — navigate **немедленно** после сканирования + lookup в фоне
2. Зелёный flash overlay (`@keyframes scanFlash`) при успешном скане
3. `ProductScreen` — `fromScan: true` → self-lookup через `resolveProductByEan` (хит в `_eanCache`)
4. Premium skeleton (shimmer) вместо hourglass spinner

**Сессия 4** (OFF removal + AI enrichment):
1. Open Food Facts полностью удалён из scan path (`fetchFromOFFViaProxy`, `findCacheProduct`, `saveToCache` убраны из resolver.js)
2. `api/off.js` → 410 Gone (endpoint убран)
3. `ExternalProductScreen.jsx` — маршрут и lazy import удалены из App.jsx
4. Background AI enrichment: после Supabase hit — если `!ingredients && !description` → `maybeEnrichInBackground()` (fire-and-forget)
5. `enrichmentEvents` EventTarget — ProductScreen слушает 'enriched' событие и обновляет карточку без перезагрузки
6. Новый каскад: session cache → IndexedDB → local store catalog → Supabase RPC → [AI enrich background] → "Не найден"

**Итого сэкономлено:** ~800ms cold start + ~500ms per scan (нормальный режим)

### KZ перевод имён — ЭТАП 4+ ЗАВЕРШЁН ✅

**Проблема:** 28% продуктов имели плохой KZ перевод (9% идентичных RU + 19% частичный перевод).
**Решение:**
1. `src/utils/localName.js` — `useLocalName(product)` + `getLocalName(product)` для kz-языка
2. Все экраны обновлены — показывают `nameKz` при lang=kz (был только CatalogScreen)
3. `translate-names-kz.mjs --fix-bad` — флаг для переименования плохих переводов
4. Промпт улучшен — примеры казахских эквивалентов (молоко→сүт, сыр→ірімшік, etc.)
5. 4 прохода переименования: 1959→1553→907→634 плохих исправлено
6. **Результат:** 90% качество (было 72%), 65% со специфичными казахскими буквами, 25% чистый казахский без спец. букв

**Экраны с useLocalName/getLocalName:** CatalogScreen, ProductScreen, UnifiedProductScreen, AIScreen, CompareScreen, AlternativesScreen, QRPrintScreen, HistoryScreen, ProductMiniCard

### Незакрытые приоритеты:
- **Этап 6: ProductScreen рефакторинг** — 1315-строчный монолит
- **Архитектура UI профиля (Этап 1-5)** — Переработка меню профиля

---

## HANDOFF NOTES

Если ты — следующий ИИ, начинающий новый чат:

1. **Прочитай `docs/CONTEXT.md`** — этот файл, текущий фокус.
2. **Прочитай `AGENTS.md`** — железные правила проекта.
3. **Сделай Vault RAG-запрос** для специфичной задачи: `vault-query("запрос")`
4. **Следующий шаг — Этап 6: Рефакторинг монолитов** (ProductScreen, ProfileScreen, HomeScreen)
   - ИЛИ Data Moat / Retail Import / unknown EAN cascade
   - ИЛИ FaqScreen i18n (531 строк FAQ_RU/FAQ_KZ — контент-данные, не UI)

### AI BEST-FIT (2026-05-03)

### V1 PILOT SCOPE DECISION (2026-05-03)

- V1 must stay narrow and shippable for a near pilot. Do not add 100-point product quality scoring, public 5-star ratings, or general feedback signals before launch.
- ProductScreen should stay clean: Fit-Check, product facts, alternatives, scan outcome. Do not clutter it with source badges, trust scores, or social rating blocks.
- CompareScreen exists at `/s/:storeSlug/product/:ean/compare/:ean2` (`src/screens/CompareScreen.jsx`). Keep existing relative comparison only; do not expand it into a product-quality score for V1.
- Unknown EAN V1 flow: if scan is unresolved, show a general not-found state. Mention that alcohol and tobacco are unsupported, but do not claim the item is alcohol unless category is known. If it is a normal grocery product, user can tap "Request product check".
- Unknown EAN queue means unresolved scans are saved as data-improvement tasks: EAN, store, timestamp, optional user/context. This improves real pilot coverage without inventing AI answers for unknown products.
- Store-facing V1 metrics should be business-simple: products synced/imported, scans, not-found scans, top requested unknown EANs. Do not make "products with ingredients" the store owner's problem; Körset owns card quality.
- IMPLEMENTED 2026-05-03: V1 unknown EAN request slice. `ProductScreen` not-found state now shows unsupported alcohol/tobacco wording and a "Request product check" action for valid EAN + store id. Logic lives in `src/domain/product/unknownEanRequest.js`, tests in `tests/unit/unknownEanRequest.test.mjs`. Central i18n files were intentionally not touched because another AI session is migrating languages.

- Лучшее применение Codex в Körset — не косметические UI-правки, а системные зоны с большим мультипликатором: Data Moat, pipeline обогащения, DB/RLS, внимательный рефакторинг монолитов.
- Самая сильная точка пользы: превращать разрозненную логику в надёжные потоки, инварианты, проверяемые скрипты и точечные архитектурные улучшения.
- Если нужен максимум ROI от следующей сессии с Codex: 1) Data Moat / retail import / unknown EAN cascade, 2) ProductScreen refactoring, 3) DB integrity/perf hardening после аудита.
