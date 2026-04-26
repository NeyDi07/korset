# Light Theme Implementation Plan — 2026-04-26

> Домен: plans
> Статус: approved for implementation planning

---

## Цель

Добавить в Körset полноценную светлую тему уровня `Light Premium` для **всего продукта**, сохранив текущую dark-идентичность, glassmorphism, premium-ощущение, мобильную плавность и почти одинаковый визуальный язык между темами.

---

## Уже согласованные продуктовые решения

1. Светлая тема входит в обязательный scope V1.
2. Покрытие — весь продукт:
   - landing `/`
   - public/store pages
   - auth / setup-profile
   - buyer-flow `/s/:storeSlug/*`
   - retail cabinet `/retail/:storeSlug/*`
3. Переключатель темы в профиле: только `Light / Dark`.
4. Системная тема устройства может использоваться только как initial value до первого выбора пользователя.
5. При переключении темы нужна красивая фирменная анимация, но без тяжёлой нагрузки на устройство.
6. Scanner целевым образом тоже поддерживает полноценную светлую тему.
7. Шрифты остаются текущие: `Advent Pro` + `Inter`.
8. Light theme должна ощущаться как тот же Körset, а не как другое приложение.
9. Customer app и retail cabinet сохраняют общий визуальный язык с лёгкой разницей по акцентам.
10. Buyer-onboarding уходит из первого пользовательского пути, но эта работа идёт отдельным roadmap-треком, не в рамках текущего внедрения темы.

---

## Дизайн-направление

### Core mood

Выбран курс: **crystal / pearl white glassmorphism**

- Основы: белый, холодный перламутр, мягкие стеклянные поверхности
- Акценты: те же фиолетовые и голубые семейства, что уже живут в dark-версии
- Контраст: не “стерильный админ-панельный белый”, а слоистый, атмосферный premium light
- Цель: при смене темы пользователь должен чувствовать “это тот же бренд, тот же продукт, та же премиальность”

### Что нельзя делать

- Нельзя делать плоский белый UI без глубины
- Нельзя просто инвертировать цвета
- Нельзя упрощать light до дешёвого “обычного SaaS”
- Нельзя перегружать мобильные устройства тяжёлыми blur/animation everywhere

---

## Техническая проблема сейчас

### Текущее состояние

1. Полноценной theme-system нет.
2. В `src/index.css` есть dark-first токены, но они односторонние.
3. В проекте много inline цветов и dark-specific поверхностей.
4. `ProfileScreen` уже содержит пункт `Тема`, но он пока `comingSoon`.
5. `index.html` и PWA manifest зашиты под тёмный shell.

### Самые тяжёлые зоны

- `src/screens/HomeScreen.jsx`
- `src/screens/ProfileScreen.jsx`
- `src/screens/ProductScreen.jsx`
- `src/screens/ScanScreen.jsx`
- `src/screens/AuthScreen.jsx`
- `src/screens/SetupProfileScreen.jsx`
- `src/screens/RetailProductsScreen.jsx`
- `src/screens/RetailSettingsScreen.jsx`
- `src/components/BottomNav.jsx`
- `src/components/RetailBottomNav.jsx`
- `src/layouts/RetailLayout.jsx`
- `src/components/ConfirmDangerModal.jsx`
- `src/components/SyncResolveModal.jsx`

---

## Архитектурный подход

### Основа

Вместо точечного перекраса нужен переход на **семантические theme-токены**.

Структура:

1. Базовый режим `data-theme="dark"` / `data-theme="light"` на `document.documentElement`
2. Набор общих CSS custom properties
3. Набор дополнительных semantic tokens для стекла, overlay, nav, header, card, input, accent, status
4. Локальный helper / hook для чтения и переключения темы
5. Сохранение выбора в `localStorage`
6. Инициализация темы до первого paint, чтобы избежать flash
7. Обновление `meta[name="theme-color"]` при смене темы

### Почему так

- Это даст единый контроль палитры
- Позволит постепенно переводить inline-styles на токены
- Снизит риск визуальной фрагментации
- Упростит поддержку темы для будущих экранов

---

## Файловая карта будущих изменений

### Theme foundation

- `src/index.css`
  - расширить токены на dark + light
  - добавить semantic glass/nav/header/form/status variables
  - добавить transition layer и reduced-motion fallback

- `src/main.jsx`
  - инициализация темы на старте
  - установка `data-theme`
  - синхронизация с `meta theme-color`

- `src/App.jsx`
  - подключение theme bootstrap / provider logic если потребуется на уровне React

- `src/utils/theme.js` или `src/contexts/ThemeContext.jsx`
  - источник истины для темы
  - чтение/запись `localStorage`
  - API `theme`, `setTheme`, `toggleTheme`

### Profile entry point

- `src/screens/ProfileScreen.jsx`
  - заменить `comingSoon` на живой переключатель темы
  - встроить кастомный animated premium toggle

### Shared shells

- `src/layouts/RetailLayout.jsx`
- `src/components/BottomNav.jsx`
- `src/components/RetailBottomNav.jsx`
- `src/components/ConfirmDangerModal.jsx`
- `src/components/SyncResolveModal.jsx`
- `src/components/OfflineBanner.jsx`

### Public / auth / core app

- `src/screens/HomeScreen.jsx`
- `src/screens/CatalogScreen.jsx`
- `src/screens/ProductScreen.jsx`
- `src/screens/UnifiedProductScreen.jsx`
- `src/screens/HistoryScreen.jsx`
- `src/screens/ProfileScreen.jsx`
- `src/screens/AuthScreen.jsx`
- `src/screens/SetupProfileScreen.jsx`
- `src/screens/NotificationSettingsScreen.jsx`
- `src/screens/PrivacySettingsScreen.jsx`
- `src/screens/StorePublicScreen.jsx`
- `src/screens/StoresScreen.jsx`

### Scanner / camera area

- `src/screens/ScanScreen.jsx`
- `src/components/RetailScannerModal.jsx`

### Retail

- `src/screens/RetailDashboardScreen.jsx`
- `src/screens/RetailProductsScreen.jsx`
- `src/screens/RetailImportScreen.jsx`
- `src/screens/RetailSettingsScreen.jsx`
- `src/screens/RetailEntryScreen.jsx`

### PWA shell

- `index.html`
- `vite.config.js`

### i18n

- `src/utils/i18n.js`
  - новые тексты для переключателя темы, если текущих ключей недостаточно

---

## Разбиение на этапы

## Этап 1 — Theme foundation и общие поверхности

### Цель

Построить базовую theme-system без тотального переписывания экранов.

### Что делаем

1. Добавляем dual-theme токены в `src/index.css`
2. Вводим semantic variables:
   - `--bg-app`
   - `--bg-surface`
   - `--bg-card`
   - `--bg-card-hover`
   - `--glass-bg`
   - `--glass-strong`
   - `--glass-border`
   - `--overlay-bg`
   - `--header-bg`
   - `--nav-bg`
   - `--nav-border`
   - `--input-bg`
   - `--input-border`
   - `--shadow-soft`
   - `--shadow-glow`
   - `--text-main`
   - `--text-sub`
   - `--text-dim`
   - `--accent-primary`
   - `--accent-secondary`
3. Добавляем bootstrap темы в `src/main.jsx`
4. Храним выбор темы в `localStorage`
5. Подключаем переключатель темы в `ProfileScreen`
6. Делаем фирменную анимацию переключения:
   - быстрый cross-fade токенов
   - легкий glass glow sweep
   - animated toggle thumb / highlight
   - fallback при `prefers-reduced-motion`
7. Переводим общие shell-слои:
   - app frame
   - header
   - bottom nav
   - retail nav
   - общие modal/overlay паттерны

### Риски

- flash неправильной темы на старте
- резкие переходы из-за inline стилей, которые ещё не переведены
- слишком тяжёлый blur/transition на бюджетных телефонах

### Критерий готовности этапа

- тема выбирается и сохраняется
- shell, nav, modal и profile toggle визуально работают в обеих темах
- нет грубого “half dark / half light” в базовой оболочке

---

## Этап 2 — Customer/public/auth screens

### Цель

Перевести основной пользовательский сценарий и публичные экраны.

### Что делаем

1. Переводим buyer-facing и public экраны на семантические токены
2. Убираем жёсткие `#fff`, `rgba(255,255,255,...)`, тёмные фоны и ручные границы там, где они должны зависеть от темы
3. Сохраняем логику акцентов:
   - customer — чуть более мягкий фиолетово-голубой glow
   - retail — чуть холоднее и деловее, но в той же семье
4. Особое внимание:
   - `HomeScreen` как витрина магазина
   - `ProductScreen` как ключевой premium-экран
   - `ProfileScreen` как место выбора темы
   - `AuthScreen` / `SetupProfileScreen` как first impression
5. Проверяем контраст:
   - бейджи
   - fit-check статусы
   - links / chips / pills
   - card surfaces

### Какие экраны в приоритете

1. `HomeScreen`
2. `ProductScreen`
3. `CatalogScreen`
4. `ProfileScreen`
5. `AuthScreen`
6. `SetupProfileScreen`
7. `StorePublicScreen`
8. `StoresScreen`
9. `HistoryScreen`
10. `NotificationSettingsScreen` / `PrivacySettingsScreen`

### Риски

- потеря премиальности на белом фоне
- слишком слабый контраст у текста/бейджей
- рассинхрон customer/public экранов по glassmorphism

### Критерий готовности этапа

- типичный пользовательский маршрут выглядит цельно:
  - вход
  - магазин
  - каталог
  - карточка товара
  - профиль
- темы переключаются без ощущения “два разных приложения”

---

## Этап 3 — Scanner, retail cabinet, PWA polish и regression pass

### Цель

Довести светлую тему до production-grade состояния на самых рискованных и наиболее визуально насыщенных зонах.

### Что делаем

1. Переводим `ScanScreen`
2. Проверяем camera-overlays, focus states, result states, torch/camera controls
3. Если полный light scanner даёт деградацию UX:
   - используем гибридный fallback только локально для camera zone
4. Переводим retail cabinet:
   - `RetailLayout`
   - `RetailDashboardScreen`
   - `RetailProductsScreen`
   - `RetailImportScreen`
   - `RetailSettingsScreen`
   - `RetailEntryScreen`
5. Обновляем PWA shell:
   - `meta theme-color`
   - manifest colors
   - standalone browser chrome ощущения
6. Финальный regression pass по всему приложению
7. При необходимости — точечная оптимизация transition / blur / shadows

### Риски

- scanner может выглядеть хуже в bright surroundings
- retail может уйти в слишком “обычный” light SaaS
- PWA browser chrome может конфликтовать с темой

### Критерий готовности этапа

- scanner usable и премиален в обеих темах
- retail остаётся “Körset-style”, а не чужой админкой
- PWA shell ощущается консистентно с выбранной темой

---

## Принципы реализации

1. **Сначала токены, потом экраны**
2. **Сначала общие паттерны, потом частные экраны**
3. **Не переписывать всё в один гигантский diff**
4. **Снижать inline-зависимости там, где это даёт реальную отдачу**
5. **Сохранять visual hierarchy из dark-версии**
6. **Любую анимацию проверять на мобильную плавность**
7. **Не тратить много времени на buyer-onboarding, который уже исключён из первого пути**

---

## Что сознательно не делаем в этой задаче

1. Не реализуем новый HomeScreen со stories и Smart Suggestion прямо сейчас
2. Не удаляем полностью код `OnboardingScreen`
3. Не переносим тему в Supabase/облачный профиль на V1
4. Не меняем шрифтовую систему
5. Не делаем редизайн бренда или новую дизайн-систему с нуля

---

## Проверки

### Функциональные

- тема переключается из профиля
- тема сохраняется после перезагрузки
- тема не сбрасывается между маршрутами
- сканер, каталог, карточка товара и retail работают в обеих темах

### Визуальные

- нет white-on-white / dark-on-dark текста
- glass surfaces читаются в обеих темах
- кнопки и чипы имеют правильный hover/active/focus
- статусные цвета fit-check остаются понятными

### Технические

- `npm run lint`
- `npm test`
- `npm run build`
- ручная проверка в браузере:
  - landing
  - store app
  - product page
  - profile
  - scanner
  - retail cabinet

### Performance sanity-check

- переключение темы не вызывает ощутимого jank
- нет тяжёлого repaint на базовых маршрутах
- transition отключается/смягчается при `prefers-reduced-motion`

---

## Порядок реального выполнения

1. Theme foundation + storage + toggle + shell
2. Customer/public/auth route set
3. Scanner + retail + PWA + polish

Это оптимальный порядок, потому что он:

- сначала уменьшает архитектурный риск,
- затем закрывает основной пользовательский опыт,
- и только потом шлифует самые сложные поверхности.

---

## Готовность к реализации

План считается согласованным после подтверждения владельцем.

Первый практический implementation-turn должен стартовать с:

1. построения theme foundation,
2. внедрения theme toggle,
3. перевода shell/nav/modals,
4. и только потом перехода к тяжёлым экранам.

---

## Статус выполнения — этап 1, 2026-04-26

Этап 1 выполнен как foundation-layer, без попытки одним diff переписать все экраны.

Сделано:

1. Добавлен `src/utils/theme.js` как единая точка управления темой: `light` / `dark`, initial value из system theme, ручной выбор в `localStorage`, обновление `data-theme`, `color-scheme` и `meta[name="theme-color"]`.
2. В `index.html` добавлен early bootstrap до React, чтобы снизить риск flash неправильной темы при первом paint.
3. В `src/index.css` введены dark/light semantic tokens для app shell, glass surfaces, overlays, nav, retail accents, inputs, shadows и premium theme toggle.
4. В профиле заменён `comingSoon` у пункта темы на живой glassmorphism-переключатель с солнцем/луной, движением thumb и лёгким sweep-переходом темы.
5. На токены переведены базовые общие слои: app frame, root background, header, buyer bottom nav, retail bottom nav, retail layout, confirm danger modal, sync resolve modal.
6. Добавлен `prefers-reduced-motion` fallback для анимации смены темы.

Проверки:

1. `npm run lint` — проходит, 44 существующих warning без errors.
2. `npm run build` — проходит; остаются прежние Vite/PWA warnings про mixed dynamic/static imports и крупный chunk.
3. `npm test` — проходит, 4/4 Playwright e2e.

Что остаётся на этап 2:

1. Перевести основные customer/public/auth экраны на semantic tokens: Home, Catalog, Product, UnifiedProduct, History, Auth, SetupProfile, StorePublic, Stores, Notification/Privacy settings.
2. Проверить визуально light/dark на реальных маршрутах и добить hardcoded dark-поверхности, которые остались внутри экранов.
3. Сохранить тёмную тему как эталон и не менять её характер без отдельного согласования.

---

## Статус выполнения — этап 2, 2026-04-26

Этап 2 выполнен как customer/public/auth rollout поверх foundation из этапа 1.

Сделано:

1. В `src/index.css` расширены semantic tokens для экранных поверхностей: subtle/muted glass, soft/strong borders, line, image backgrounds, text-soft/faint/disabled, badge, sky accent, card shadows.
2. Переведены основные buyer-facing экраны:
   - `HomeScreen`
   - `CatalogScreen`
   - `ProductScreen`
   - `UnifiedProductScreen`
   - `HistoryScreen`
3. Переведены public/auth/settings экраны:
   - `AuthScreen`
   - `SetupProfileScreen`
   - `StorePublicScreen`
   - `StoresScreen`
   - `NotificationSettingsScreen`
   - `PrivacySettingsScreen`
4. Убраны основные hardcoded dark surfaces (`#07070F`, `#080C18`, `rgba(255,255,255,...)`, `#fff`) там, где они отвечали за текст, карточки, инпуты, линии, header, card/image surfaces.
5. Сохранены намеренные белые элементы на цветных CTA/иконках и белые thumb-кружки переключателей, так как они не создают white-on-white в light theme.

Проверки:

1. `npm run lint` — проходит, 44 существующих warning без errors.
2. `npm run build` — проходит; остаются прежние Vite/PWA warnings про mixed dynamic/static imports и крупный chunk.
3. `npm test` — проходит, 4/4 Playwright e2e.

Что остаётся на этап 3:

1. Scanner/camera flow: `ScanScreen` и scanner overlays.
2. Retail cabinet deep pass: `RetailDashboardScreen`, `RetailProductsScreen`, `RetailImportScreen`, `RetailSettingsScreen`, `RetailEntryScreen`.
3. PWA polish: manifest/browser chrome/status bar colors и финальный визуальный regression pass по light/dark.
