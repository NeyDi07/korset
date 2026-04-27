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

## АКТУАЛЬНЫЕ СТАТИСТИКИ БД (2026-04-27)

- **~7099 active** global_products
- **Реальные EAN: ~7031** (~99.0%)
- **Fake EAN: ~73** — arbuz_ ~29 + korzinavdom_ ~44 (kaspi_ = 0)
- **Состав: ~87.5%**
- **Нутриенты: ~81%** (5767)
- **R2 CDN: 99.96%** продуктов с картинками на cdn.korset.app
- store_products для MARS (store-one): ~8755

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

---

## АКТУАЛЬНЫЙ СПИСОК ПЛАНОВ (по приоритету)

### P0 — Критичные для продаж

| # | Задача | Статус | Комментарий |
|---|--------|--------|-------------|
| 1 | **i18n: хардкод русский текст** | 🟡 CatalogScreen ✅ | CatalogScreen — весь хардкод убран (compare.cancel/selectSecond, loading/loadingMore/searchingServer, modeBanner). Остальные экраны (ProductScreen, EanRecoveryScreen) — НЕ НАЧАТО |
| 2 | **Фронтенд: name_kz по языку** | 🟡 CatalogScreen ✅ | CatalogScreen + comparePin — отображает nameKz при lang=kz. ProductScreen/RetailProductsScreen — НЕ НАЧАТО. Нужно: `lang === 'kz' && product.nameKz ? product.nameKz : product.name` |
| 3 | **Migration 016** — проверить и применить | ✅ ПРИМЕНЕНА | profile-banners bucket + avatar_id/banner_url колонки. AuthContext уже использует с graceful fallback. Баннеры работают: 7 пресетов + custom upload. |

### P1 — Важно для продукта

| # | Задача | Статус | Комментарий |
|---|--------|--------|-------------|
| 4 | **Data Moat: data_quality_score → каскад** | � ЧАСТИЧНО | `resolver.js` реализует каскад: IndexedDB → store_products → global_products → external_product_cache (TTL 30д OFF) → demo → AI enrichment. `data_quality_score` и `source_confidence` пробрасываются через `normalizers.js` → `product.sourceMeta`. НЕТ: отображения confidence-бейджа в UI, сплит-теста <80 предупреждение, TTL 7д для AI. |
| 5 | **USDA enrichment** — проверить proxy | 🟡 ПРОВЕРИТЬ | Скрипт использует Vercel proxy `/api/usda`, не прямые вызовы. Статус proxy неясен. ~457 продуктов без состава. |
| 6 | **Zero-Friction onboarding** | 🗺️ PLANNED | Убрать блокирующий OnboardingScreen из first-run, перенести обучение на HomeScreen + физматериалы. Подтверждено владельцем, отложено на отдельный этап. |

### P2 — Улучшения

| # | Задача | Статус | Комментарий |
|---|--------|--------|-------------|
| 7 | **~73 fake EAN дочистка** | 🔄 В ПРОЦЕССЕ | Пользователь вносит штрихкоды вручную через EAN Recovery screen. Автоматизированные подходы исчерпаны. |
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
