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
| **Удалить мусорные товары** | ✅ 17 деактивировано (электроника, стройматериалы, открытки) |
| **Перевод инноязычного состава** | ✅ 100% русский состав (0 нерусских) |
| **Batch upsert** | ✅ arbuz-catalog-parser переведён на batch (100x быстрее) |
| **No-barcode-possible** | ✅ 209 продуктов помечены (202 Arbuz СТМ + 7 весовые) |
| **Каталог: виртуализация Virtuoso** | ✅ рендерит только ~10-15 видимых вместо 3236 |
| **Каталог: двухэтапная загрузка** | ✅ первые 50 мгновенно + фон догрузка всех |
| **Каталог: light поля** | ✅ 14 полей вместо 30+, payload ~5x меньше |
| **ProductScreen: ленивый fetch** | ✅ полные данные подгружаются при открытии карточки |
| **БД-фиксы** (CASCADE, GIN) | 🔜 |
| **Фронтенд: name_kz по языку** | 🔜 |
| **USDA enrichment** | 🔜 457 продуктов без состава |
| **Корзина дома парсер** | ✅ 387 молочных за 38с (93% состав, 98% нутриенты) |

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

**ТЕКУЩИЕ СТАТИСТИКИ БД (2026-04-21):**
- **~3030 active** global_products (было 2662 — +367 от Корзина)
- **Состав: ~92%** (было ~86%)
- **Русский состав: 100%**
- **Нутриенты (ккал/белки/жиры): ~14% → ~25%** (Корзина дала нутриенты)
- Korzinavdom source: 367 продуктов
- Без состава: ~300 (было 457)

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
1. Корзина дома: остальные категории (~14000 продуктов)
2. R2 upload для Корзина картинки
3. EAN enrichment на кандидатов (NPC + DDG)
4. USDA enrichment на ~300 продуктов без состава
5. Импорт прайс-листа (RetailImportScreen)
6. БД-фиксы (CASCADE, GIN)
7. Фронтенд: name_kz по языку

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
- **2571/2607 картинок мигрировано** (36 неудаляемых: 7 Kaspi блокировка, ~17 локальных путей, ~5 Unsplash, 7 Kaspi gallery)
- `getImageUrl()` интегрирован, Cloudflare Image Transformations НЕ работают (платный план)
- Скрипт миграции: `scripts/migrate-images-to-r2.mjs` (обновлён: сохраняет original URL + фильтр по r2_key)
