# KÖRSET — БЫСТРЫЙ КОНТЕКСТ

> Для ИИ-ассистента. Единственный файл для ручной загрузки в начале чата.
> Глубокая архитектура → `ARCHITECTURE.md`. Аудит → `docs/vault/plans/audit-full.md`. Правила → `AGENTS.md`.

---

## Что такое Körset

Store-context AI assistant (mobile-first PWA) для офлайн-магазинов Казахстана.
Сканирует штрихкод → Fit-Check (аллергии, Халал, диеты). B2B2C: платят магазины (~15 000 тг/мес SaaS).

**Стек:** React 18 + Vite + Supabase + Vercel Serverless + OpenAI
**Код:** JavaScript (не TypeScript), Vanilla CSS (не Tailwind)
**Стиль:** Dark Premium Glassmorphism, Advent Pro + Manrope, Material Symbols Only

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
/retail/:storeSlug/...      → Retail Cabinet
```

---

## Что работает

- Supabase Auth (Google OAuth), онбординг 2-шаговый
- Сканер штрихкодов, AIScreen (чат с ИИ + RAG)
- Fit-Check (Red/Orange — детерминированный, Yellow — AI)
- Push-уведомления, История + Избранное, Smart Merge
- Retail Cabinet (Dashboard, Products, Settings)
- Офлайн: App Shell + IndexedDB каталог + очередь сканов + OfflineBanner
- RAG через Supabase pgvector (301 чанк, 20 файлов)
- RLS на 13 таблицах, JWT auth на API

---

## Железные правила (кратко)

0. **Vault Protocol:** НАЧАЛО чата → прочитай CONTEXT.md. КОНЕЦ чата → сохрани в Vault + embed. → `AGENTS.md`
1. Сначала анализ → потом код. Предложи план → получи апрув.
2. Не ломать работающее.
3. Экраны покупателя → только внутри `/s/:storeSlug/`.
4. Иконки: Качественные SVG для премиального вида. Material Symbols — опционально.
5. Аватары только `<ProfileAvatar />`.
6. Не переписывать стили на светлые.
7. Новый текст → через `useI18n` (RU/KZ обязательно).
8. Оценивай через B2B: «Помогает ли это продать подписку?»

---

## Текущий фокус

| Фокус | Статус |
|-------|--------|
| **Arbuz catalog import** | ✅ 2228 продуктов из Arbuz → 3236 активных в DB |
| **Каталог: русские имена** | ✅ NPC --fix-names |
| **R2 CDN миграция** | ✅ ЗАВЕРШЕНА — 2571/2607 картинок в R2 |
| **Data Moat Pipeline** | ✅ NPC + Arbuz + USDA — все работают |
| **NPC EAN enrichment** | ✅ 1320/3236 (40%) реальных EAN |
| **Удалить мусорные товары** | ✅ 17 деактивировано |
| **Перевод инноязычного состава** | ✅ 100% русский состав |
| **Batch upsert** | ✅ arbuz-catalog-parser переведён на batch (100x быстрее) |
| **No-barcode-possible** | ✅ 209 продуктов помечены (202 Arbuz СТМ + 7 весовые) |
| **Каталог: виртуализация Virtuoso** | ✅ рендерит только ~10-15 видимых вместо 3236 |
| **Каталог: двухэтапная загрузка** | ✅ первые 50 мгновенно + фон догрузка всех |
| **Каталог: light поля** | ✅ 14 полей вместо 30+, payload ~5x меньше |
| **ProductScreen: ленивый fetch** | ✅ полные данные подгружаются при открытии карточки |
| **БД-фиксы** (CASCADE, GIN) | 🔜 |
| **Фронтенд: name_kz по языку** | 🔜 |
| **USDA enrichment** | 🔜 457 продуктов без состава |
| **R2 CDN миграция** | ✅ 8110/8146 (99.6%) на cdn.korset.app |
| **Корзина дома парсер** | ✅ 5462 продуктов, 14 категорий |

**ARBUZ CATALOG PARSER v2 — BATCH UPSERT:**

```
Стратегия: API search по 82 категориям → batch fetch existing → batch upsert
Скрипт: scripts/arbuz-catalog-parser.cjs
Инкрементальное сохранение прогресса каждые 10 продуктов
Ретраи на API таймаутах (3 попытки)
```

**Ключевые открытия Arbuz API:**
- `/api/v1/shop/categories` = **404** (НЕ работает)
- **API search** = даёт `ingredients` + `nutrition` напрямую (НЕ нужен detail API!)
- **API barcode** = пустые строки (НЕ даёт штрихкоды)
- **NPC name search** = даёт EAN для ~40% продуктов
- **82 категорий** обойдены через search queries

**ТЕКУЩИЕ СТАТИСТИКИ БД (2026-04-22):**
- **~8204 active** global_products (arbuz: 2045 + korzinavdom: 5458 + другие: ~701)
- **Состав: 100%** (0 без состава)
- **Нутриенты: ~85%**
- **R2 CDN: 8115/8118** (99.96% продуктов с картинками)
- 3 мёртвых Kaspi URL (реальные продукты без картинки)
- 35 без картинки (казахстанские шоколадные бренды: Alma Chocolates, NA MEDU, Спартак — нет в OFF/Korzinavdom)
- Arbuz СТМ удалены, брендовые восстановлены
- store_products для ERALY: 8760

**EAN MATCHING — ИТОГИ ТЕСТИРОВАНИЯ:**
- NPC + DDG + OFF кросс-валидация: 25% verified, 85% any EAN
- DuckDuckGo — единственный работающий веб-поисковик (Google/Yandex/Bing/Ozon/WB — все 403)
- NPC часто мэтчит НЕ ТОТ продукт (Barilla sauce → pasta EAN)
- Все коммерческие API не работают без ключей

**КАТАЛОГ — ВИРТУАЛИЗАЦИЯ + ДВУХЭТАПНАЯ ЗАГРУЗКА (сессия 9-10):**
- ✅ react-virtuoso: Virtuoso (list) + VirtuosoGrid (grid), overscan=600
- ✅ Двухэтапная загрузка: первые 50 (light поля) за 0.3 сек → фон догрузка всех
- ✅ Light поля: 14 полей вместо 30+, payload ~5x меньше
- ✅ ProductScreen: ленивый fetch полных данных при открытии
- ✅ ImageCarousel: fallback на product.image если product.images пустой
- ✅ viewMode сохраняется в sessionStorage
- ✅ Scroll position сохраняется в sessionStorage (initialTopMostItemIndex)

**GIT ЧИСТКА (сессия 10):**
- ✅ git-filter-repo: .git 397МБ → 3.4МБ (удалены data/, public/products/, zip/xlsx/csv, node_modules/ из истории)
- ✅ .gitignore обновлён: data/, .opencode/node_modules/
- ✅ 5 дублирующих vault файлов удалено, RAG эмбеддинги обновлены (386 чанков)
- ✅ 3453 store_products привязаны к магазину ERALY

**НОВЫЕ СКРИПТЫ (сессия 8):**
- `scripts/test-ean-matching-methods.cjs` — v1: 8 методов, все 0%
- `scripts/test-ean-matching-v2.cjs` — v2: NPC/OFF, NPC-translit 65%
- `scripts/test-ean-web-search.cjs` — web search: DDG/Bing/Yandex/Google/Ozon/WB
- `scripts/test-ean-cross-validate.cjs` — ЛУЧШИЙ: NPC+DDG+OFF кросс-валидация
- `scripts/translate-composition.cjs` — ✅ перевод состава через OpenAI gpt-4o-mini

**НОВЫЕ СКРИПТЫ (сессия 7):**
- `scripts/translate-composition.cjs` — ✅ перевод состава через OpenAI gpt-4o-mini

**⚠️ DB CONSTRAINTS:**

1. `source_primary_check` — ✅ ИСПРАВЛЕНО: миграция 007 применена
2. `global_products_ean_key` — UNIQUE на EAN. arbuz_XXX EAN для продуктов без штрихкода
3. `halal_status_check` — ✅ OK

**API ключи (в .env.local):**
- NPC_API_KEY ✅
- USDA_API_KEY ✅ (работает через Vercel proxy)
- VERCEL_TOKEN ✅

**СКРИПТЫ PIPELINE:**
1. `scripts/arbuz-catalog-parser.cjs` — ✅ ГЛАВНЫЙ: Arbuz-first bulk import (API+NPC+R2)
2. `scripts/arbuz-enrich.cjs` — ✅ обогащение существующих продуктов через Arbuz
3. `scripts/npc-enrich.cjs` — ✅ + `--fix-names` режим
4. `scripts/usda-enrich.cjs` — ✅ через Vercel proxy
5. `scripts/arbuz-import.cjs` — ✅ старый Arbuz-first pipeline (не запускался)
6. `scripts/validate-ean.cjs` — ✅ EAN валидация
7. `scripts/audit-catalog.cjs` — ✅ аудит качества
8. `scripts/add-category-prefix.cjs` — ✅ prepend русской категории

**МИГРАЦИИ:**
- 006 (`alternate_eans`): ✅ ВЫПОЛНЕНА
- 007 (`add_pipeline_sources`): ✅ ПРИМЕНЕНА
- 008 (`r2_image_columns`): ✅ ПРИМЕНЕНА

**ScanScreen РЕДИЗАЙН (сессия 11, 2026-04-21):**
- ✅ Blur-шапка: кнопка Назад + заголовок + бейдж магазина
- ✅ Камера (60%) — `flex: 6, minHeight: 0`
- ✅ Нижняя панель (40%) — 4 кнопки (Фонарик/Галерея/Камера/Сравнить), ручной ввод EAN, история последних 5 сканов
- ✅ i18n ключи: scanTitle, gallery, compare, cameraSwitch, manualInputPlaceholder, manualInvalid, recentScans (RU + KZ)
- ✅ `saveRecentScan` — сохраняет в `localStorage` (`korset_recent_scans`, 5 последних)
- ✅ ESLint-фиксы: `startScannerRef` для рекурсии, `t.scan.offlineNotFound` вместо `lang`

**RETAIL PHASE 1 ЗАВЕРШЁН (сессия 12, 2026-04-21):**
- ✅ `supabase/migrations/009_store_profile_fields.sql` — новые поля stores (logo_url, short_description, instagram_url, whatsapp_number, twogis_url, website_url), Storage bucket `store-logos`, RLS политики, 3 RPC функции (get_unique_customers, get_lost_revenue, get_scan_coverage)
- ✅ `src/components/ConfirmDangerModal.jsx` — новый modal с вводом слова СБРОС/ТАЗАРТУ перед удалением каталога
- ✅ `src/screens/RetailSettingsScreen.jsx` — полный редизайн: лого upload, краткое/полное описание, контакты (Instagram, WhatsApp, 2GIS, сайт, телефон), фикс критического бага onClick-в-style
- ✅ `src/utils/retailAnalytics.js` — getUniqueCustomers, getLostRevenue, getScanCoverage + серверная пагинация getStoreCatalogProducts (PAGE_SIZE=40)
- ✅ `src/screens/RetailDashboardScreen.jsx` — новые метрики: Покупателей (зелёный), Упущённая выручка ~₸ (красный), Покрытие каталога % (прогресс-бар с цветом по порогам)
- ✅ `src/screens/StorePublicScreen.jsx` — страница магазина для покупателей: лого, описание (аккордеон), контакты с ссылками, i18n
- ✅ `src/screens/HomeScreen.jsx` — short_description под адресом + кнопка Подробнее → StorePublicScreen
- ✅ `src/screens/RetailProductsScreen.jsx` — useInfiniteQuery + Load More кнопка + дебаунс поиска 350ms + серверный поиск через ilike + optimistic updates адаптированы для infinite query

**ПОРЯДОК ЗАДАЧ (следующий чат):**
1. Применить миграцию 011 (korzinavdom image_source) через SQL Editor
2. EAN enrichment на 7212 кандидатов (NPC + DDG)
3. Импорт прайс-листа (RetailImportScreen)
4. БД-фиксы (CASCADE, GIN)
5. Фронтенд: name_kz по языку

**КОРЗИНА ДОМА (korzinavdom.kz) — API парсер:**
- API: `https://api.korzinavdom.kz/client/` (открытый, без авторизации)
- Скрипт: `scripts/korzinavdom-parser.cjs`
- Метод: list API → 5 параллельных detail API → batch upsert
- Скорость: ~10 продуктов/сек
- **ВАЖНО: `pageSize` не работает, нужно `size=500`** для получения всех товаров (иначе лимит 20)
- Данные: название, состав, ккал/белки/жиры/углеводы, бренд, страна, картинка, халяль
- Нет: EAN/штрихкод, аллергены
- Молочка: ✅ 982 (94% состав, 97% нутриенты)
- Снеки: ✅ 256 (90% состав, 88% нутриенты)

Офлайн-режим: ✅ ГОТОВО (6 слоёв, 85/100)

**R2 CDN:**
- R2 bucket `korset-images` (EEUR), custom domain `cdn.korset.app` ✅
- **8110/8146 картинок мигрировано** (99.6%)
- 36 мёртвых URL (7 Kaspi блокировка + 6 Unsplash сток + 23 local paths)
- 58 продуктов без картинок вообще
- `getImageUrl()` интегрирован, Cloudflare Image Transformations НЕ работают (платный план)
- Скрипт миграции: `scripts/migrate-images-to-r2.mjs` (фикс пагинации + остановка при отсутствии прогресса)
- Миграция 011: `supabase/migrations/011_add_korzinavdom_image_source.sql` — нужно применить через SQL Editor

## Заметка сессии — 2026-04-24 аудит проекта

- Проверка сборки: `npm run build` проходит вне sandbox; Vite/PWA build OK, есть предупреждения о смешанных dynamic/static imports для `supabase.js` и `offlineDB.js`.
- Проверка lint: `npm run lint` падает с 2 ошибками в `src/screens/AuthScreen.jsx` (`EyeBtn` объявлен внутри render) и 46 предупреждениями.
- Проверка E2E: `npm test` запускается вне sandbox; 2 теста проходят, 2 падают. Падения выглядят устаревшими (`text=Körset` strict locator, `/s/store-one` ждёт `Магазин 1`).
- Аудит сохранён в `docs/vault/plans/project-audit-2026-04-24.md`.
- Добавлен лёгкий pipeline памяти: шаблоны в `docs/vault/templates/`, описание в `docs/vault/architecture/assistant-memory-pipeline.md`, команда `npm run memory:save`.

## Заметка сессии — 2026-04-25 RetailImport V1

- Реализован первый рабочий импорт прайс-листа в Retail Cabinet: `src/screens/RetailImportScreen.jsx` теперь принимает CSV/XLS/XLSX, показывает предпросмотр, ошибки, отчёт и применяет изменения.
- Добавлен `src/utils/retailImport.js`: парсинг колонок `EAN/Цена/Наличие/Полка/Название`, валидация EAN, дедупликация, нормализация наличия, store-scoped обновление `store_products`.
- Важно по архитектуре: V1 обновляет только уже существующие `store_products`. Неизвестные EAN не создаются автоматически, а попадают в отчёт для Data Moat, чтобы не загрязнять `global_products`.
- Новый UI-текст вынесен в `src/utils/i18n.js` (`retail.import`) на RU/KZ, компонент использует `useI18n`.
- Проверки: `npm run lint` проходит с прежними 46 warning; `npm test` — 4/4; `npm run build` — OK. Build добавляет отдельный lazy chunk `xlsx-D_0l8YDs.js` (~143KB gzip), но PWA precache вырос до ~1800 KiB.
- Рекомендуемый следующий фокус: добавить шаблон CSV/XLSX для импорта, затем bulk RPC/Data Moat flow для неизвестных EAN, подтвердить миграцию 011 и перейти к БД/search/scaling fixes.

## Заметка сессии — 2026-04-24 стабилизация проверок

- Добавлен `.gitignore` для `test-results/`, чтобы Playwright-артефакты не попадали в `git status`.
- В `src/screens/AuthScreen.jsx` компонент `EyeBtn` вынесен из render на уровень модуля.
- В `tests/e2e/landing.spec.js` обновлены устаревшие проверки: landing ищет конкретный heading `Körset`, store route проверяет загрузку app shell вместо старого текста магазина; `page.goto` переведён на `waitUntil: 'domcontentloaded'`, чтобы не ловить timeout на внешних ресурсах.
- Проверки после правок: `npm run lint` проходит с 0 errors и 46 warnings; `npm run build` проходит; `npm test` проходит 4/4.
- Следующий оптимальный фокус: настоящий `RetailImportScreen` как P0 для продажи магазинам.

## Заметка сессии — 2026-04-24 режим доступа и архитектурные рельсы

- Добавлен vault-документ `docs/vault/architecture/assistant-access-and-architecture-governance.md`: уровни доступа ассистента, правила апрува, запреты для production, rollback/verification перед рискованными операциями.
- В `.env.local` присутствуют ключи Supabase/OpenAI/R2/Vercel/NPC/USDA; прямые CLI `psql`, `supabase`, `wrangler`, `vercel` локально не найдены.
- Supabase виден как один локально настроенный project host: `tcvuffoxwavqdexrzwjj.supabase.co`; отдельный dev/staging пока не подтверждён.
- Рекомендованный режим: сначала read-only Supabase-аудит и архитектурные DB/security/scaling фиксы, затем RetailImport и новые фичи. Любые внешние write-операции — только после явного апрува владельца.
