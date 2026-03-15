# Körset — Implementation Plan: Full Cleanup & Upgrades

## Goal
Исправить все проблемы из технического аудита, мигрировать AI с Groq на OpenAI GPT-4o-mini, сделать полную двуязычность, убрать мусор и дублирование.

## User Review Required

> [!IMPORTANT]
> **OpenAI API Key:** Для работы AI нужен OpenAI API ключ с балансом минимум $5.
> 1. Перейти на https://platform.openai.com → API keys → Create new
> 2. Добавить баланс: Settings → Billing → Add credit → $5 minimum
> 3. Сохранить ключ — он понадобится в `.env` как `OPENAI_API_KEY` (без `VITE_` — ключ будет только на сервере)

> [!WARNING]
> **ExternalProductScreen.jsx — баг:** Функции [checkFit()](file:///c:/projects/korset/src/screens/ExternalProductScreen.jsx#38-102), [NutriGrid()](file:///c:/projects/korset/src/screens/ExternalProductScreen.jsx#110-134), [formatShelfLine()](file:///c:/projects/korset/src/screens/ProductScreen.jsx#80-85), [HeroImage()](file:///c:/projects/korset/src/screens/ProductScreen.jsx#405-419), [humanizeSpecKey()](file:///c:/projects/korset/src/screens/ProductScreen.jsx#426-453) используют переменную `lang` как глобальную, но она определена только внутри компонента. Это вызовет `ReferenceError` при рендере. Будет исправлено передачей `lang` как параметра.

---

## Proposed Changes

### Phase 1: Cleanup — Dead files

#### [DELETE] [App.jsx](file:///c:/projects/korset/src/screens/App.jsx)
Мёртвая копия [src/App.jsx](file:///c:/projects/korset/src/App.jsx). Не импортируется нигде.

#### [DELETE] [BottomNav.jsx](file:///c:/projects/korset/src/screens/BottomNav.jsx)
Мёртвый дубль [src/components/BottomNav.jsx](file:///c:/projects/korset/src/components/BottomNav.jsx).

#### [DELETE] [GeneralAIScreen.jsx](file:///c:/projects/korset/src/screens/GeneralAIScreen.jsx)
Не подключён к роутам. Функциональность покрыта [AIAssistantScreen.jsx](file:///c:/projects/korset/src/screens/AIAssistantScreen.jsx).

#### [DELETE] [mockAI.js](file:///c:/projects/korset/src/utils/mockAI.js)
Mock-ответы — будет реальный AI через OpenAI.

#### [DELETE] [seed_products.js](file:///c:/projects/korset/seed_products.js)
Стейлый: ссылается на таблицу `products` вместо `global_products`. Есть [scripts/seed-products.js](file:///c:/projects/korset/scripts/seed-products.js).

#### [DELETE] `src/{screens,components,utils,data}/`
Пустая директория с невалидным именем (артефакт bash-команды).

#### [DELETE] `Текстовый документ.txt`
Случайный файл.

---

### Phase 2: Shared data & components extraction

#### [NEW] [allergens.js](file:///c:/projects/korset/src/data/allergens.js)
Единый источник данных об аллергенах: id, name (RU/KZ), icon component reference. Используется в ProfileScreen, OnboardingScreen, fitCheck.

#### [NEW] [dietGoals.js](file:///c:/projects/korset/src/data/dietGoals.js)
Единый источник данных о diet goals: id, name (RU/KZ), icon. Используется в ProfileScreen, OnboardingScreen.

#### [NEW] [KorsetAvatar.jsx](file:///c:/projects/korset/src/components/KorsetAvatar.jsx)
Shared компонент аватара AI — сейчас дублируется в 3 файлах (AIScreen, AIAssistantScreen, GeneralAIScreen).

#### [MODIFY] [ProfileScreen.jsx](file:///c:/projects/korset/src/screens/ProfileScreen.jsx)
- Импортировать allergens/dietGoals из `src/data/` вместо inline определений
- Убрать ~150 строк дублированных SVG-иконок — использовать shared
- Функциональность и UI **не меняется**

#### [MODIFY] [OnboardingScreen.jsx](file:///c:/projects/korset/src/screens/OnboardingScreen.jsx)
- Аналогично: импортировать из shared data
- Убрать ~140 строк дублированных определений и иконок

#### [MODIFY] [fitCheck.js](file:///c:/projects/korset/src/utils/fitCheck.js)
- Импортировать `ALLERGEN_NAMES` из `src/data/allergens.js` вместо inline определения

---

### Phase 3: AI Migration (Groq → OpenAI GPT-4o-mini)

#### [NEW] [ai.js (API route)](file:///c:/projects/korset/api/ai.js)
Vercel serverless function — прокси для OpenAI:
- Принимает `{ messages, mode, product?, lang }` из клиента
- Формирует system prompt на сервере (product context + user profile)
- Вызывает OpenAI `gpt-4o-mini` с `max_tokens: 400`
- Возвращает `{ reply }` — текст ответа
- **API ключ ТОЛЬКО на сервере** (`process.env.OPENAI_API_KEY`)

#### [NEW] [ai.js (client service)](file:///c:/projects/korset/src/services/ai.js)
Клиентский модуль — единая точка для вызова AI:
- `askProductAI(messages, product, lang)` — для AIScreen
- `askGeneralAI(messages, lang)` — для AIAssistantScreen
- Внутри — `fetch('/api/ai', ...)` → серверный прокси

#### [MODIFY] [AIScreen.jsx](file:///c:/projects/korset/src/screens/AIScreen.jsx)
- Убрать `import.meta.env.VITE_GROQ_API_KEY`
- Убрать прямой fetch к Groq
- Использовать `askProductAI()` из `src/services/ai.js`
- Использовать `KorsetAvatar` из `src/components/`
- Добавить i18n

#### [MODIFY] [AIAssistantScreen.jsx](file:///c:/projects/korset/src/screens/AIAssistantScreen.jsx)
- Аналогично: убрать Groq, использовать `askGeneralAI()`
- Использовать `KorsetAvatar` из `src/components/`
- Полная i18n

#### [MODIFY] [.env.example](file:///c:/projects/korset/.env.example)
- Убрать `VITE_GROQ_API_KEY`
- Добавить `OPENAI_API_KEY` (без `VITE_` — только серверный)

---

### Phase 4: Architecture improvements

#### [NEW] [ErrorBoundary.jsx](file:///c:/projects/korset/src/components/ErrorBoundary.jsx)
Class component с fallback UI и кнопкой "Перезагрузить".

#### [MODIFY] [App.jsx](file:///c:/projects/korset/src/App.jsx)
- Обернуть в `<ErrorBoundary>`
- Добавить чтение `?store=` из URL → сохранение в localStorage

#### [NEW] [store.js](file:///c:/projects/korset/src/utils/store.js)
- `getStoreId()` — чтение из localStorage
- `setStoreFromURL()` — парсинг URL param `?store=CODE`
- При первом визите по QR → сохраняет storeId навсегда

#### [MODIFY] [ScanScreen.jsx](file:///c:/projects/korset/src/screens/ScanScreen.jsx)
- Импортировать `getStoreId()`, передавать в `lookupProduct(ean, storeId)`
- Добавить полную i18n

#### [MODIFY] [ExternalProductScreen.jsx](file:///c:/projects/korset/src/screens/ExternalProductScreen.jsx)
- **FIX BUG:** `checkFit()`, `NutriGrid()`, `formatShelfLine()` — передавать `lang` как параметр
- Полная i18n для оставшихся hardcoded строк

#### [MODIFY] [ProductScreen.jsx](file:///c:/projects/korset/src/screens/ProductScreen.jsx)
- **FIX BUG:** `formatShelfLine()`, `HeroImage()`, `humanizeSpecKey()` — аналогично, `lang` не доступен вне компонента
- Добавить i18n для оставшихся строк

---

### Phase 5: Full i18n (RU/KZ)

#### [MODIFY] [i18n.js](file:///c:/projects/korset/src/utils/i18n.js)
Добавить ВСЕ недостающие ключи для:
- `scan` — «Сканер», «Наведите на штрихкод», «Товар не найден», ошибки камеры
- `product` — «Карточка товара», «Характеристики», «Состав», «Халал», кнопки
- `catalog` — «Каталог», фильтры, сортировка, поиск
- `alternatives` — «Альтернативы», «Подходят под ваш профиль», «Найти в магазине»
- `ai` — «Спросить AI», chips, placeholders, ошибки
- `common` — «Назад», «Загрузка», «Ошибка», «Попробуйте ещё»

#### [MODIFY] [AlternativesScreen.jsx](file:///c:/projects/korset/src/screens/AlternativesScreen.jsx)
- Добавить `useI18n()` и заменить все русские строки на ключи из `t.alternatives`

#### [MODIFY] [CatalogScreen.jsx](file:///c:/projects/korset/src/screens/CatalogScreen.jsx)
- Переключить inline i18n на ключи из `t.catalog`

---

## Verification Plan

### Automated Tests
Проект не имеет тестов. Создание тестов выходит за рамки текущего cleanup.

### Browser Verification
1. `npm run dev` → открыть в браузере
2. Проверить что приложение запускается без ошибок
3. Переключить язык на KZ → проверить что ВСЕ экраны показывают казахский текст:
   - Home ✓
   - Catalog ✓
   - Profile ✓
   - Scan ✓
   - AI Assistant ✓
4. Проверить console — нет `ReferenceError`, нет `VITE_GROQ` warnings
5. `npm run build` → убедиться что билд проходит без ошибок

### Manual Verification (пользователь)
1. Добавить `OPENAI_API_KEY` в `.env`
2. Запустить `npm run dev`
3. Перейти на `/ai` → отправить сообщение → убедиться что AI отвечает
4. Открыть любой товар → нажать «Спросить AI» → убедиться что AI отвечает по товару
5. Добавить `?store=test-store` в URL → проверить что storeId сохраняется
6. Deploy на Vercel → проверить что API route `/api/ai` работает
