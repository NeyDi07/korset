# KÖRSET — БЫСТРЫЙ КОНТЕКСТ

> Для ИИ-ассистента. Единственный файл для ручной загрузки в начале чата.
> Глубокая архитектура → `ARCHITECTURE.md`. Аудит → `docs/vault/plans/audit-full.md`. Правила → `AGENTS.md`.

---

## Что такое Körset

Store-context AI assistant (mobile-first PWA) для офлайн-магазинов Казахстана.
Сканирует штрихкод → Fit-Check (аллергии, Халал, диеты). B2B2C: платят магазины (~15 000 тг/мес SaaS).

**Стек:** React 18 + Vite + Supabase + Vercel Serverless + OpenAI
**Код:** JavaScript (не TypeScript), Vanilla CSS (не Tailwind)
**Стиль:** Dark/Light Premium Glassmorphism, Advent Pro + Inter, Material Symbols опционально

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

## АКТУАЛЬНЫЕ СТАТИСТИКИ БД (2026-04-28)

- **7046 active** global_products (51 non-food + pet_food деактивировано)
- **Реальные EAN: 6980** (99.1%), **Fake EAN: 66** (0.9% — реальные продукты без штрихкода)
- **store_products active: 6859** (1 магазин MARS, 187 gp ещё не завезены)
- **EAN совпадение: 100%** (0 mismatches, 0 сирот)
- **208 garbage quantity** → null (weight-by-weight товары)
- **Состав: ~81%** (5767)
- **R2 CDN: 99.96%** продуктов с картинками на cdn.korset.app

---

## МИГРАЦИИ

| # | Назначение | Статус |
|---|-----------|--------|
| 001-005 | Базовые (RLS, pgvector, indexes, columns) | ✅ применены |
| 006 | alternate_eans | ✅ применена |
| 007 | source_primary + confidence | ✅ применена |
| 008 | R2 image columns | ✅ применена |
| 009 | store profile fields + 3 RPC | ✅ применена |
| 010 | korzinavdom source | ✅ применена |
| 011 | korzinavdom image_source CHECK | ✅ применена |
| 012 | unknown_ean_staging + bulk RPC + data_quality_score + TTL | ✅ применена |
| 013 | ON DELETE CASCADE/SET NULL на 13 FK | ✅ применена |
| 014 | GIN jsonb + tsvector + полнотекстовый поиск | ✅ применена |
| 015 | NOT NULL + CHECK + scan_events indexes | ✅ применена |
| 016 | profile avatar_id + banner_url + profile-banners bucket | ⚠️ нужна ручная проверка применения через SQL Editor |

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

---

## 🚨 АКТУАЛЬНЫЙ ПРИОРИТЕТ (2026-04-28)

**Полный архитектурно-безопасный аудит выполнен** — см. `docs/AUDIT_2026-04-28.md` (1300+ строк, 92 находки: 10🔴 / 30🟠 / 34🟡 / 18🟢).

**План восстановления** — см. `docs/HARDENING_PLAN.md` (5 этапов, ~10 рабочих дней).

### Этапы (выполнять строго по порядку, БЕЗ визуала пока):

1. **🔴 Этап 1 — Безопасность (1.5–2 дня)** — закрыть 10 критичных дыр (RBAC ean-recovery, ean-search auth, RLS plan/expires, scan_events anon spam, xlsx CVE, vite.config dup, error-leak, /api/off, валидация AI).
2. **🟠 Этап 2 — Фундамент БД (1 день)** — индексы, search_path, atomic increments, audit_log, cleanup cron.
3. **🟢 Этап 3 — Тесты + CI + Sentry (1 день)** — fitCheck unit-тесты, GitHub Actions, /api/health, supabase CLI.
4. **🔵 Этап 4 — Офлайн + RBAC (1 день)** — DB_VERSION migration, SW Background Sync, isAdmin через server.
5. **🟣 Этап 5 — Рефакторинг + чистка (2–3 дня)** — разрезать монолиты (Product/Profile/Home), lazy-routes, Data Moat UI, чистка корня.

### Топ-10 критичных дыр (must fix Этап 1):

1. `api/ean-recovery.js` — любой залогиненный юзер удаляет каталог.
2. `api/ean-search.js` — public proxy без auth, выжирает платный ключ.
3. RLS `stores_update_owner` — владелец апит себе тариф бесплатно.
4. RLS `scan_events_insert_anon` — анон-спам метрик любого магазина.
5. Нет `idx_users_auth_id` — RLS делает full-scan на каждый запрос.
6. `xlsx ^0.18.5` — CVE-2023-30533 + CVE-2024-22363 в импорте Excel.
7. `localApiPlugin` в `vite.config.js` — dev-эндпоинт без auth/rate-limit.
8. `fitCheck.js` — 0 тестов на юр.критичный код.
9. `offlineDB.js` — нет `client_token`, anti-spam защита нерабочая.
10. `/api/off` эндпоинт не существует — каскад резолвера обрывается.

**Общая оценка проекта:** ~50/100 (документация говорила 65 — была оптимистична).

---

## ЗАМОРОЖЕНО до завершения Этапов 1-5

- Визуал / Premium Glassmorphism Landing
- Smart Merge UI редизайн
- Grid/List Switch полировка
- Footer + логотипы
- Home Stories
- Юр.лицо, оферта, биллинг-энфорсмент (отложено до первых продаж)

---

## СТАРЫЕ P0/P1 — переехали в HARDENING_PLAN Этап 5

### P0 (старые) — теперь в Этапе 5

| # | Задача | Статус | Комментарий |
|---|--------|--------|-------------|
| 1 | **i18n: хардкод русский текст** | 🟡 CatalogScreen ✅ | ProductScreen/EanRecoveryScreen — Этап 5.19 |
| 2 | **Фронтенд: name_kz по языку** | 🟡 CatalogScreen ✅ | ProductScreen — Этап 5.19 |
| 3 | **Migration 016** — проверить и применить | ✅ ПРИМЕНЕНА | profile-banners bucket + avatar_id/banner_url. |

### P1 — Важно для продукта

| # | Задача | Статус | Комментарий |
|---|--------|--------|-------------|
| 4 | **Data Moat: data_quality_score → каскад** | � ЧАСТИЧНО | `resolver.js` реализует каскад: IndexedDB → store_products → global_products → external_product_cache (TTL 30д OFF) → demo → AI enrichment. `data_quality_score` и `source_confidence` пробрасываются через `normalizers.js` → `product.sourceMeta`. НЕТ: отображения confidence-бейджа в UI, сплит-теста <80 предупреждение, TTL 7д для AI. |
| 5 | **USDA enrichment** — проверить proxy | 🟡 ПРОВЕРИТЬ | Скрипт использует Vercel proxy `/api/usda`, не прямые вызовы. Статус proxy неясен. ~457 продуктов без состава. |
| 6 | **Zero-Friction onboarding** | 🗺️ PLANNED | Убрать блокирующий OnboardingScreen из first-run, перенести обучение на HomeScreen + физматериалы. Подтверждено владельцем, отложено на отдельный этап. |

### P2 — Улучшения

| # | Задача | Статус | Комментарий |
|---|--------|--------|-------------|
| 7 | **Fake EAN дочистка** | ✅ ЗАВЕРШЕНО | 5988 fake→real EAN синхронизировано в store_products, 345 дублей деактивировано. 0 fake EAN осталось. |
| 8 | **USDA enrichment** — обогащение продуктов без состава | 🔜 После проверки proxy | ~457 продуктов без состава |
| 9 | **Офлайн-режим refinements** | 🔜 | 85/100, основа работает |
| 10 | **Масштабирование** — партицирование scan_events | 🔜 НЕ НАЧАТО | Аудит: 40/100 |

---

## ВЫПОЛНЕННЫЕ ЗАДАЧИ (для контекста)

- ✅ **Light theme** — 3 этапа: foundation + storage + toggle, customer/auth screens, scanner + retail + PWA polish
- ✅ **EAN Coverage 77.2% → 99.0%** — resolver v2/v3, NPC harvest, OFF search, weight cleanup, alternate_eans
- ✅ **Retail Dashboard: метрики в тенге** — Упущённая выручка ₸, Покупатели, Покрытие каталога %, Топ-5, период 7/30 дней
- ✅ **Retail Import** — CSV/XLS/XLSX парсинг, preview, bulk RPC, unknown EAN staging, CSV экспорт отчёта, шаблоны
- ✅ **CompareScreen** — двухэтапный scan flow (pin → navigate), multi-factor scoring (safety 35 + quality 25 + E-additive 20 + halal 10), dynamic rows по категории, AI commentary, i18n RU+KZ
- ✅ **Data Moat каскад** — `resolver.js`: IndexedDB → store_products → global_products → external_product_cache (TTL 30д) → demo → AI enrichment. `data_quality_score` + `source_confidence` в `product.sourceMeta`
- ✅ **Retail Products** — infinite query, серверный поиск с debounce, inline edit (₸), barcode scanner, delete с confirm
- ✅ **Retail Settings** — лого upload, описание, контакты (IG/WA/2GIS/сайт/телефон), QR-код, push toggles, danger zone
- ✅ **EAN Recovery** — serverless API (JWT + service_role), DELETE/update-EAN/update-name, barcode scanner, inline name edit
- ✅ **Profile Edit** — баннеры (7 photo presets WebP + custom upload), аватары (9 presets), Supabase Storage
- ✅ **БД-фиксы (миграции 012-015)** — CASCADE FK, GIN indexes, tsvector полнотекстовый поиск, data_quality_score, TTL, bulk RPC
- ✅ **Каталог: Virtuoso + двухэтапная загрузка** — light поля, scroll position, viewMode
- ✅ **Каталог: i18n + nameKz полировка** — весь хардкод убран, compare.cancel/selectSecond RU+KZ, nameKz в grid/list/comparePin, гибридный поиск (клиент+сервер), fit-бейджи, вес/объём вместо EAN, plural склонения
- ✅ **Quantity parser** — `src/utils/parseQuantity.js`: извлечение веса/объёма/шт из названия продукта. Fallback: DB→name→nameKz→specs.weight. 25/25 тестов. i18n: шт→дана, за кг→кг үшін. Интегрирован в: mapRowToProduct, normalizers, storeCatalog, CatalogScreen search, offlineDB. UI: CatalogScreen (grid+list), UnifiedProductScreen, ProductScreen, CompareScreen, ProductMiniCard, ExternalProductScreen — все используют getDisplayQuantity().
- ✅ **Quantity DB Backfill** — `scripts/backfill-quantity.mjs`: 718 продуктов обновлено (quantity из name), покрытие 96.4% (было ~85%). 0 ошибок. Dry run → --live.
- ✅ **Data Quality Cleanup** — `scripts/cleanup-nonfood.mjs`: 51 non-food+pet_food деактивировано (is_active=false), 208 garbage quantity → null, linked store_products → is_active=false
- ✅ **Fake EAN Sync** — `scripts/sync-store-product-eans.mjs`: 5988 store_products.ean обновлены arbuz_/kaspi_/korzinavdom_ → real EAN, 345 дубликатов деактивировано, пагинация (8686→8341 active). 384 non-fake mismatches отложены (ручная проверка).
- ✅ **Banner overhaul (2026-04-27)** — 7 фото-баннеров в WebP (160KB total, 99% compression), `scripts/optimize-banners.mjs` pipeline, PWA precache fix (`globPatterns` → `injectManifest` config), SelectedDot clipping fix, clean 2×4 grid
- ✅ **R2 CDN миграция** — 99.96% картинок на cdn.korset.app
- ✅ **Состав: перевод через OpenAI** — 100% русский состав
- ✅ **Batch upsert** — arbuz-catalog-parser 100x быстрее
- ✅ **Git чистка** — .git 397МБ → 3.4МБ

---

## API ключи (в .env.local)

- NPC_API_KEY ✅
- USDA_API_KEY ✅ (работает через Vercel proxy, статус proxy проверить)
- VERCEL_TOKEN ✅

---

## EAN MATCHING — ИТОГИ

- NPC + DDG + OFF кросс-валидация: 25% verified, 85% any EAN
- DuckDuckGo — единственный работающий веб-поисковик (Google/Yandex/Bing/Ozon/WB — все 403)
- NPC часто мэтчит НЕ ТОТ продукт (Barilla sauce → pasta EAN)
- Все коммерческие API не работают без ключей
- **Автоматизированные подходы полностью исчерпаны** — NPC (3 раунда), OFF (2 раунда), UPCitemdb

---

## Ключевые открытия Arbuz API

- `/api/v1/shop/categories` = **404** (НЕ работает)
- API search = даёт `ingredients` + `nutrition` напрямую
- API barcode = пустые строки (НЕ даёт штрихкоды)
- NPC name search = даёт EAN для ~40% продуктов

---

## КОРЗИНА ДОМА (korzinavdom.kz)

- API: `https://api.korzinavdom.kz/client/` (открытый, без авторизации)
- Скрипт: `scripts/korzinavdom-parser.cjs`
- **ВАЖНО: `pageSize` не работает, нужно `size=500`**
- Данные: название, состав, ккал/белки/жиры/углеводы, бренд, страна, картинка, халяль
- Нет: EAN/штрихкод, аллергены

---

## ТЕКУЩИЙ ФОКУС (2026-04-28)

- **Data Quality Cleanup ЗАВЕРШЁН** — non-food/pet_food деактивированы, fake EAN синхронизированы, garbage quantity почищена. **7046 active global_products, 6867 store_products active в MARS**.
- **Landing visual system Stage 1 ЗАВЕРШЁН** — Advent Pro, hero 3D-сцена, B2B Retail Cabinet preview.
- **HARDENING Этап 1 ЗАВЕРШЁН (security pass 1, commit 518839c)** — 10 критичных дыр. Migrations 017+018: RBAC, RLS, atomic RPC, audit_stores, search_path, vault_embeddings closed. Code: api/ean-search REMOVED, error sanitization, xlsx→exceljs (CVE-2023-30533), validation в api/ai. ✅ Vercel autodeploy live.
- **HARDENING Этап 2 ЗАВЕРШЁН (TR TS allergen audit, commit 883e94e)** — 8 пробелов (gluten/fish/halal/diabetes/vegan/dairy_free + 2 false-positive). Migrations 019+019a+020 (legacy ID purge: nuts→tree_nuts, shellfish→crustaceans, molluscs→mollusks, sulphites→sulfites, tree-nuts→tree_nuts). 5 источников в коде. ExternalProductScreen унифицирован на canonical `checkProductFit`.
- **HARDENING Этап 3 ЗАВЕРШЁН (Tests + CI + Health, commit 883e94e)** — **93 unit-теста** (было 0), GitHub Actions, `/api/health`.
- **HARDENING Этап 4 ЗАВЕРШЁН (security pass 2 + DB framework, commit 011211f)** — **🚨 КРИТИЧНАЯ дыра закрыта**: `RetailLayout.jsx` читал `user_metadata?.role==='admin'` (модифицируется клиентом!). Migration 021: trigger sync `users.is_admin → auth.users.raw_app_meta_data.is_admin` (server-controlled JWT claim) + backfill + verify. AuthContext.isAdmin из app_metadata. RetailLayout.jsx использует useAuth().isAdmin. **Migration 021 запущена в production 2026-04-28 ~07:50 UTC+05** (✅ verified, NOTICE: backfilled N users, verification OK). offlineDB: DB_VERSION framework v1→v2 с `runMigrations(db,oldV,newV,tx)` + `blocked/blocking/terminated` callbacks + `client_token` index. Background Sync direct API → отложен (требует idb в sw.js + auth tokens в SW storage, >1 час риска).
- **Следующие шаги (по приоритету):**
  1. **HARDENING Этап 5 (СЛЕДУЮЩИЙ ФОКУС)** — рефакторинг крупных монолитных компонентов: `ProductScreen.jsx` (1400+ строк), `HomeScreen.jsx`, `ProfileScreen.jsx` + lazy-routes + Data Moat UI бейдж. См. `docs/HANDOFF_2026-04-28.md` для детального брифа.
  2. **Data Moat (слабое место #1, 25/100)** — data_quality_score column + триггер, TTL источников, каскад OFF→USDA→AI, КЗ-базы. P0 для пилота.
  3. 384 non-fake EAN mismatches — ручная проверка (ALPRO/Cadbury/Ferrero мёржи)
  4. i18n ProductScreen, EanRecoveryScreen; name_kz в ProductScreen
  5. Лендинг Stage 2 — B2C-секции (сценарий у полки, Fit-Check)

## HANDOFF NOTES

Если ты — следующий ИИ, начинающий новый чат:

1. **Прочитай `docs/HANDOFF_2026-04-28.md`** — детальный бриф со списком задач, acceptance criteria, и git workflow.
2. **Прочитай `AGENTS.md`** — железные правила проекта (Vault Protocol, language, темы, etc.).
3. **Прочитай этот файл** — текущий фокус.
4. **Сделай Vault RAG-запрос** для специфичной задачи: `node scripts/query-vault.mjs "запрос" --domain knowledge`
