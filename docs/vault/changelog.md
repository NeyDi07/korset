# Лог сессий разработки Körset

> Домен: changelog
> Дата начала: 2026-04-17

---

## 2026-04-17 — Сессия 1: Полный аудит + RAG + P0/P1

**Выполнено:**
- Полный аудит: 26 экранов, 8 компонентов, 4 контекста, 15 утилит, 5 API, SQL-схема
- 4 критических бага экранов — исправлены
- 6 HIGH багов контекстов — исправлены
- 6 CRITICAL уязвимостей безопасности — исправлены (RLS 13 таблиц, JWT auth, CORS, rate limit)
- RAG-система через Supabase pgvector (216 чанков, 14 файлов)
- База знаний: e-additives (~60 добавок), halal-certification, allergen-cross-contamination
- Миграции 002-004 запущены

**Откатано (ошибка):**
- React.lazy — добавлен → откатан (задержка при переходах)
- BottomNav SVG → Material — заменён → откатан (хозяин подбирал вручную)
- УРОК: не менять дизайн без разрешения хозяина

---

## 2026-04-17 — Сессия 2: Офлайн + Архитектурный аудит

**Выполнено:**
- Архитектурный аудит — 6 слабых мест (оценки 25-85/100)
- Офлайн-режим полностью реализован (6 слоёв, 85/100)
  - Слой 0: App Shell (Workbox Precache)
  - Слой 1: IndexedDB каталог (~3000 товаров, ~9MB)
  - Слой 2: Resolver с IndexedDB lookup
  - Слой 3: Очередь сканов (100 FIFO + Background Sync)
  - Слой 4: Картинки — НЕТ в V1 (placeholder)
  - Слой 5: OfflineContext + OfflineBanner
- 7 багов найдено и исправлено при самопроверке
- Документация обновлена (ARCHITECTURE.md, ROADMAP, CONTEXT.md)
- Vault RAG: +55 чанков (offline-resilience, data-moat-strategy, обновлённый audit-full)

**Не выполнено:**
- Data Moat — СЛЕДУЮЩИЙ ФОКУС
- Импорт прайс-листа (P0 блокер)
- БД-фиксы (UNIQUE, CASCADE, триггеры, GIN)
- Метрики в тенге

---

## 2026-04-17 — Сессия 3: Оптимизация инфраструктуры ассистента

**Выполнено:**
- AGENTS.md создан — Vault Protocol (CONTEXT.md + RAG при старте, сохранение при конце)
- Vault консолидирован: 20 файлов → 12, 301 чанков → 239
- Skills установлены: supabase-postgres-best-practices, supabase
- MCP подключены: Context7 (документации), Grep (GitHub код)
- Custom Tools созданы: vault-query.ts, vault-embed.ts
- opencode.json создан (MCP конфиг)
- CONTEXT.md упрощён — убраны дубли с audit

---

## 2026-04-18/19 — Сессия 4-5: Data Moat Pipeline — NPC + Arbuz + USDA

**Выполнено:**
- Arbuz API v1 обнаружен и документирован — полностью открытый API (auth + search + detail)
- `scripts/arbuz-enrich.cjs` — полностью переписан с HTML scraper на API v1
  - Прод запуск: 190/190 processed, 143 found (75%), 127 comp, 124 КБЖУ, 23 халал
- `scripts/npc-enrich.cjs` — прод запуск: 288/289 matched (99.7%), 164 GTIN, 288 NTIN
  - ~130 DB updates (rest blocked by source_primary_check constraint)
- `scripts/usda-enrich.cjs` — написан, но USDA API unreachable из KZ (нужен Vercel proxy)
- `api/usda.js` — написан, не задеплоен (нет VERCEL_TOKEN)
- halal_status fix: `'certified'` → `'yes'` (valid values: unknown/yes/no)
- Миграция 007 написана (add 'npc','arbuz','usda' to source_primary) — НЕ применена (нет psql/MCP)

**Проблемы:**
- `source_primary_check` — 'npc' не в списке. Скрипт использует 'kz_verified' как обход
- `global_products_ean_key` — UNIQUE конфликт при одинаковых GTIN для вариантов товаров
- USDA API unreachable напрямую из KZ (ETIMEDOUT) — нужен Vercel proxy
- 155 товаров ещё с kaspi_ EAN (NPC не смог матчить — дубли EAN)

**Статистика БД:**
- 685 active products
- Без состава: 81 (было ~190), Без КБЖУ: 110
- С халал=yes: 35, С kz_verified: 115
- С kaspi_ EAN: 155

---

## 2026-04-19 — Сессия 6: R2 CDN миграция + интеграция getImageUrl()

**Выполнено:**
- R2 bucket `korset-images` создан (регион EEUR)
- Custom domain `cdn.korset.app` привязан и работает (200 OK)
- 580/620 картинок мигрировано с внешних CDN → R2
  - Источники: OpenFoodFacts, Arbuz, Kaspi → `cdn.korset.app/products/{EAN}/main.jpg`
  - 40 пропущено (локальные плейсхолдеры, недоступные URL)
  - `original_image_url` сохранены для отката
- `scripts/utils/r2-upload.cjs` — утилита загрузки в R2
- `scripts/migrate-images-to-r2.mjs` — скрипт миграции
- `src/utils/imageUrl.js` — `getImageUrl()` + helpers (упрощён: без Cloudflare Transformations)
- Интегрирован `getImageUrl()` во все компоненты:
  - `StoreContext.jsx`, `normalizers.js`, `RetailProductsScreen.jsx`, `RetailDashboardScreen.jsx`
- Миграция 008 (r2 columns) применена
- Arbuz-enrich обновлён — автозагрузка в R2
- Запушено в main, Vercel задеплоил

**Открытие:**
- Cloudflare Image Transformations (`/cdn-cgi/image/...`) НЕ работают с R2 — нужен платный Cloudflare Images план
- R2 dev URL (`pub-*.r2.dev`) отдаёт 401 — публичный доступ выключен, но кастомный домен работает

**Не выполнено:**
- 40 картинок не загружены — retry при следующем чате
- Проверка отображения на телефоне — завтра

---

## 2026-04-19 — Сессия 7: Каталог cleanup + Pipeline фикс + USDA proxy

**Выполнено:**
- **api/usda.js** задеплоен на Vercel + USDA_API_KEY добавлен в env
- **USDA proxy работает** — `https://korset.app/api/usda?query=X` → 200 OK, данные корректные
- **Миграция 007** подтверждена применённой (npc, arbuz, usda в source_primary_check)
- **Каталог аудит** (audit-catalog.cjs): 385/685 (56.2%) англ. имён, 554 без name_kz
- **npc-enrich --fix-names**: обработал 628 продуктов, 385→2 англ. имён (−99.5%)
  - Раздельные name/EAN апдейты (решает duplicate EAN: name обновляется даже если GTIN занят)
  - source_primary='npc' (было 'kz_verified')
- **arbuz-enrich**: обновляет name/name_kz из Arbuz, source_primary='arbuz', --fix-names режим
  - Прод запуск: 34/81 found, 20 comp, 19 КБЖУ, фото → R2
- **usda-enrich**: работает через Vercel proxy, source_primary='usda'
  - Прод запуск: 22/50 обогащено
- **add-category-prefix.cjs**: 2 оставшихся англ. имени → prepend русской категории
- **arbuz-import.cjs**: новый Arbuz-first pipeline (Arbuz = primary, NPC/OFF = enrichment)
- **Ключевой фикс**: r2-upload.cjs require path (`.cjs` extension), SUPABASE_URL/SUPABASE_KEY constants

**Результаты:**
| Метрика | Было | Стало |
|---------|------|-------|
| Англ. имена | 385 (56.2%) | 2 (0.3%) |
| Пустой name_kz | 554 (80.9%) | 171 (25%) |
| source_primary=npc | 0 | 359 |
| source_primary=openfoodfacts | 382 | 28 |

**Не выполнено:**
- arbuz-import.cjs не запущен (нужен тестовый запуск --dry-run)
- Фронтенд name_kz по языку
- Retry 40 R2 failed
- Duplicate EAN cleanup (деактивация дубликатов)

---

## 2026-04-19 — Сессия 8: Полный Arbuz catalog import + NPC + перевод состава

**Выполнено:**
- **arbuz-catalog-parser.cjs** — переписан на batch upsert (100x быстрее, 0 ошибок)
  - Инкрементальное сохранение прогресса каждые 10 продуктов
  - Ретраи на API таймаутах (3 попытки, 2 сек между попытками)
  - Обработка ошибок в Phase 1 (пропуск неудачных запросов)
- **Полный Arbuz импорт**: 2228 продуктов из Arbuz → 3236 активных в DB (было 685)
- **NPC EAN enrichment**: 1320/3236 (40%) реальных EAN (было 30%)
  - Обработано ~635 продуктов в двух батчах по 500
- **Удаление мусора**: 17 деактивировано (11 электроника, 3 открытки, 3 стройматериалы)
- **Перевод состава**: `translate-composition.cjs` через OpenAI gpt-4o-mini
  - 331 инноязычный состав → 0 (100% русский)
  - Batch по 15 продуктов, стоимость ~$0.05 за всё
- **0 дубликатов EAN** — UNIQUE constraint работает

**Результаты:**
| Метрика | Было (сессия 7) | Стало (сессия 8) |
|---------|----------------|-------------------|
| Active продуктов | 685 | 3236 |
| С составом | ~75% | 86% (2779) |
| Русский состав | ~48% | **100%** (2779/2779) |
| Реальные EAN | 63% | 40% (больше продуктов без EAN) |
| Arbuz primary | 26 | 2237 |

**Не выполнено:**
- USDA enrichment на 457 без состава
- R2 upload для ~2000 новых Arbuz картинок
- Фронтенд: name_kz по языку
- Импорт прайс-листа (RetailImportScreen)
- БД-фиксы (CASCADE, GIN)

---

## 2026-04-26 — Сессия 14: NPC EAN Harvest (combo approach)

**Выполнено:**
- Эксперимент с 6 методами NPC-поиска → combo стратегия (brand+name + brand+core+weight + brand-only)
- Новый `scripts/npc-eans-harvest.cjs`: 2-3 запроса/продукт, ВСЕ EAN в alternate_eans, лучший GTIN → primary
- Обработка duplicate EAN (если занят → в alternate, пробует следующий)
- 3 партии harvest (~900 продуктов): 1320 → 2558 реальных EAN (+94%)
- Avg 40 EAN/продукт (GTINs + NTINs + alternates)
- Сканер уже поддерживает alternate_eans (resolver.js)
- USDA-enrich фикс: не перезаписывает source_primary
- NPC-enrich фикс: пагинация .range() (Supabase limit 1000)
- CONTEXT.md + vault обновлены

**Не выполнено:**
- Продолжить harvest для оставшихся ~5595 продуктов (партиями по 2000)
- Продукты без бренда — нужен другой подход
- USDA enrichment — API ключ disabled, нужен новый
