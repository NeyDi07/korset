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

## АКТУАЛЬНЫЕ СТАТИСТИКИ БД (2026-05-01)

- **7008 active** global_products (38 деактивировано: 4 не-еда + 33 pet_food + 1 вино)
- **18 категорий** (было 227 хаотичных значений), 0 некорректных категорий
- **category_raw/subcategory_raw** — оригинальные значения сохранены для аудита
- **Реальные EAN: 6980** (99.1%), **Fake EAN: 66** (0.9% — реальные продукты без штрихкода)
- **store_products active: 6859** (1 магазин MARS, 187 gp ещё не завезены)
- **EAN совпадение: 100%** (0 mismatches, 0 сирот)
- **208 garbage quantity** → null (weight-by-weight товары)
- **Состав: ~81%** (5767)
- **R2 CDN: 99.96%** продуктов с картинками на cdn.korset.app
- **Attribute extraction applied:** 195 packaging (can 50, pouch 68, bottle_glass 38, bottle_plastic 35, tub 4, tetrapak 0), 680 fat_percent (min 0.5%, max 82.5%), diet tags: sugar_free 54, organic 35, gluten_free 17, lactose_free 14, fitness 7

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
| 015 | NOT NULL + CHECK + scan_events indexes | ✅ применены |
| 016 | profile avatar_id + banner_url + profile-banners bucket | ✅ применена |
| 017-018 | Security hardening + DB foundation (RLS, audit, atomic RPC, tsvector) | ✅ применены |
| 019-021 | Allergen normalization, app_metadata sync, admin trigger | ✅ применены |
| 022 | idx_users_auth_id (RLS perf) | ✅ создана, применить через SQL Editor |
| 022b | category normalization (category_raw/subcategory_raw + CHECK + index) | ✅ применена |
| 023 | Fix SECURITY DEFINER on analytics views | ✅ применена |
| 024 | Attribute extraction (packaging_type + fat_percent + quality score update) | ✅ применена, backfill выполнен (964 updates, 0 errors) |

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

---

## 🚨 АКТУАЛЬНЫЙ ПРИОРИТЕТ (2026-05-01)

**Полный архитектурно-безопасный аудит выполнен** — см. `docs/AUDIT_2026-04-28.md` (1300+ строк, 92 находки: 10🔴 / 30🟠 / 34🟡 / 18🟢).

**План восстановления** — см. `docs/HARDENING_PLAN.md` (5 этапов, ~10 рабочих дней).

### Этапы (выполнять строго по порядку, БЕЗ визуала пока):

1. **🔴 Этап 1 — Безопасность (1.5–2 дня)** — 10/10 ЗАКРЫТО ✅
2. **🟠 Этап 2 — Фундамент БД (1 день)** — индексы, search_path, atomic increments, audit_log, cleanup cron.
3. **🟢 Этап 3 — Тесты + CI + Sentry (1 день)** — fitCheck unit-тесты, GitHub Actions, /api/health, supabase CLI.
4. **🔵 Этап 4 — Офлайн + RBAC (1 день)** — DB_VERSION migration, SW Background Sync, isAdmin через server.
5. **🟣 Этап 5 — Рефакторинг + чистка (2–3 дня)** — разрезать монолиты (Product/Profile/Home), lazy-routes, Data Moat UI, чистка корня.

### Топ-10 критичных дыр (must fix Этап 1) — 10/10 ЗАКРЫТО ✅

1. ✅ `api/ean-recovery.js` — RBAC через `is_admin_user` RPC
2. ✅ `api/ean-search.js` — endpoint удалён
3. ✅ RLS `stores_update_owner` — триггер `protect_stores_billing`
4. ✅ RLS `scan_events_insert_anon` — `client_token` + EAN regex
5. ✅ Нет `idx_users_auth_id` — миграция `022_idx_users_auth_id.sql`
6. ✅ `xlsx ^0.18.5` — заменён на `exceljs`
7. ✅ `localApiPlugin` в `vite.config.js` — удалён
8. ✅ `fitCheck.js` — 35+ unit тестов
9. ✅ `offlineDB.js` — `DB_VERSION = 3`, индекс `client_token`
10. ✅ `/api/off` — endpoint создан

### Monitoring (Production-ready)
- **Sentry** — фронтенд + бэкенд. Нужен `VITE_SENTRY_DSN` + `SENTRY_DSN` в Vercel env.
- **Rate limiting** — `/api/ai.js` (JWT), `/api/off.js`, `/api/usda.js` (IP, 15 req/min)
- **Input validation** — EAN regex на /off, max query на /usda
- **Health check** — `/api/health` проверяет Supabase, OpenAI, RAG, Push, Sentry
- **Runbook** — `docs/vault/operations/monitoring-runbook.md`

**Общая оценка проекта:** ~80/100 (было ~50/100).

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

| # | Задача | Статус |
|---|--------|--------|
| 1 | i18n: хардкод русский текст | CatalogScreen ✅, ProductScreen/EanRecovery — Этап 5 |
| 2 | name_kz по языку | CatalogScreen ✅, ProductScreen — Этап 5 |
| 3 | Migration 016 | ✅ применена |

---

## ВЫПОЛНЕННЫЕ ЗАДАЧИ (для контекста)

- ✅ **Light theme** — 3 этапа: foundation + storage + toggle, customer/auth screens, scanner + retail + PWA polish
- ✅ **EAN Coverage 77.2% → 99.0%** — resolver v2/v3, NPC harvest, OFF search, weight cleanup, alternate_eans
- ✅ **Retail Dashboard: метрики в тенге** — Упущённая выручка ₸, Покупатели, Покрытие каталога %, Топ-5, период 7/30 дней
- ✅ **Retail Import** — CSV/XLS/XLSX парсинг, preview, bulk RPC, unknown EAN staging, CSV экспорт отчёта, шаблоны
- ✅ **CompareScreen** — двухэтапный scan flow, multi-factor scoring, AI commentary, i18n RU+KZ
- ✅ **Data Moat каскад** — resolver.js: IndexedDB → store_products → global_products → external_product_cache → demo → AI
- ✅ **Retail Products** — infinite query, серверный поиск, inline edit (₸), barcode scanner, delete
- ✅ **Retail Settings** — лого upload, описание, контакты, QR-код, push toggles, danger zone
- ✅ **EAN Recovery** — serverless API, DELETE/update-EAN/update-name, barcode scanner, inline name edit
- ✅ **Profile Edit** — баннеры (7 WebP presets + custom), аватары (9 presets), Supabase Storage
- ✅ **БД-фиксы (миграции 012-015)** — CASCADE FK, GIN indexes, tsvector, data_quality_score, TTL, bulk RPC
- ✅ **Каталог: Virtuoso + двухэтапная загрузка** — light поля, scroll position, viewMode
- ✅ **Каталог: i18n + nameKz** — хардкод убран, compare RU+KZ, гибридный поиск, fit-бейджи, вес/объём
- ✅ **Quantity parser** — `parseQuantity.js`: вес/объём/шт из названия, 25/25 тестов, интегрирован везде
- ✅ **Quantity DB Backfill** — 718 продуктов обновлено, покрытие 96.4%
- ✅ **Data Quality Cleanup** — 51 non-food+pet_food деактивировано, 208 garbage quantity → null
- ✅ **Fake EAN Sync** — 5988 store_products.ean обновлены, 345 дублей деактивировано, 100% совпадение
- ✅ **Banner overhaul** — 7 фото-баннеров WebP, PWA precache fix
- ✅ **R2 CDN миграция** — 99.96% картинок на cdn.korset.app
- ✅ **Состав: перевод через OpenAI** — 100% русский состав
- ✅ **Batch upsert** — arbuz-catalog-parser 100x быстрее
- ✅ **Git чистка** — .git 397МБ → 3.4МБ
- ✅ **Category normalization (Этап 1)** — 227→18 категорий, 6515 обновлено, CHECK+index, pipeline обновлён
- ✅ **Attribute extraction (Этап 2)** — packaging_type (195), fat_percent (680), diet_tags (sugar_free 54, organic 35, gluten_free 17, lactose_free 14, fitness 7), halal upgrade. 964 updates, 0 errors. Frontend: model, normalizers, fitCheck (low_fat), offlineDB, StoreContext, storeCatalog, CatalogScreen
- ✅ **3 раунда аудита фиксов** — LIGHT_FIELDS, mapRowToProduct, storeCatalog, CatalogScreen duplicate key, 12 false positives в attributeExtractor

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

## ТЕКУЩИЙ ФОКУС (2026-05-01)

**Этап 1 + Этап 2 ЗАВЕРШЕНЫ. Всё закоммичено, git push выполнен, Vercel деплоит.**

### СЛЕДУЮЩИЕ ШАГИ (по приоритету):

1. **Этап 3 — Нормализация названий** — Title Case для 934 ALL CAPS, удаление мусорных суффиксов упаковки из name (КНВРТ, ТБА, Ж/Б, etc. — уже извлечены в packaging_type), дедупликация двойного веса, обрезка длинных имён (>80 символов)
2. **Этап 4 — Перевод имён на KZ** — `scripts/translate-names-kz.mjs` уже существует
3. **RetailImportScreen** — P0 блокер для B2B продаж (экран пустой)
4. **ProductScreen** — 1315-строчный монолит, packaging_type/fat_percent не отображаются в UI
5. **Catalog card дизайн** — пользователь хочет Figma mockup → потом реализация

### НЮАНСЫ для следующего чата:

- `packaging_type` = tetrapak имеет 0 продуктов — данные источников не содержат ТБА/Т/Б суффиксов
- `low_fat` diet goal добавлен в `dietGoals.js`, нужен `lowfat` icon asset
- Pipeline скрипты используют `globalThis._normalizeCategory` + `globalThis._extractAttributes` через dynamic import
- `SUPABASE_SERVICE_ROLE_KEY` (не `SUPABASE_SERVICE_KEY`) — правильный env var
- 12 false positives исправлены в attributeExtractor: Ж/Б context, СТБ word-boundary, убраны брик/пластик/light/diet/эко/био/витам/без молок/BG flag bug
- `calc_data_quality_score()` обновлён: +3 packaging_type, +3 fat_percent

---

## HANDOFF NOTES

Если ты — следующий ИИ, начинающий новый чат:

1. **Прочитай `docs/CONTEXT.md`** — этот файл, текущий фокус.
2. **Прочитай `AGENTS.md`** — железные правила проекта.
3. **Сделай Vault RAG-запрос** для специфичной задачи: `vault-query("запрос")`
4. **Следующий шаг — Этап 3** (нормализация названий) ИЛИ RetailImportScreen (P0 блокер)
