# Light Theme Discovery — 2026-04-26

> Домен: plans
> Статус: discovery / awaiting product decisions

---

## Контекст

Пользователь инициировал крупную задачу по внедрению светлой темы в Körset и попросил сначала провести полный анализ, найти все риски и только после этого составить поэтапный план реализации.

Важно: это не просто косметический рефакторинг. В памяти проекта уже зафиксировано решение `Dark Premium Glassmorphism` как осознанная часть продукта. Значит новая задача должна трактоваться как переход к **двухтемной системе**, а не как отказ от dark-идентичности.

Дополнительно в ходе обсуждения подтверждён смежный продуктовый pivot: buyer-onboarding уходит из обязательного first-run flow (`Zero-Friction`). Реализация этого pivot не входит в текущий этап светлой темы, но должна учитываться в roadmap, чтобы не строить theme-архитектуру вокруг скоро удаляемого обязательного онбординга.

---

## Что подтвердилось по Vault

Файл `docs/vault/decisions/architecture-decisions.md` фиксирует причины выбора тёмной темы:

1. Премиальный glassmorphism-эффект для B2B2C.
2. Читаемость в ярком магазине.
3. Экономия батареи на OLED.
4. Органичный переход к экрану сканера/камеры.
5. Дифференциация от большинства светлых SaaS.

Следствие: светлая тема не должна убить премиальность, ухудшить сканерный UX или сломать визуальную дифференциацию.

---

## Что найдено в коде

### 1. Theme-system отсутствует

- Нет `ThemeProvider` / `ThemeContext`.
- Нет `data-theme` или аналогичного атрибута на `documentElement`.
- Нет работы с `prefers-color-scheme`.
- Нет хранения темы в `localStorage`.
- Нет хранения темы в cloud profile / Supabase.
- В `ProfileScreen` уже есть UI-пункт `Тема`, но это пока `comingSoon`.

### 2. Базовые токены есть, но они dark-only

В `src/index.css` уже есть полезный фундамент:

- `--bg`
- `--surface`
- `--card`
- `--border`
- `--text`
- `--text-sub`
- `--text-dim`
- `--primary*`
- статусы `success/error/warning`

Но сейчас эти токены определены только в dark-варианте и не образуют полной семантической дизайн-системы для dual-theme.

### 3. Основной риск — inline dark styles

Быстрый аудит показал минимум **34 UI-файла** с hardcoded цветами и dark-specific поверхностями.

Файлы с наибольшей плотностью таких зависимостей:

1. `src/screens/HomeScreen.jsx`
2. `src/screens/RetailProductsScreen.jsx`
3. `src/screens/ProfileScreen.jsx`
4. `src/screens/ProductScreen.jsx`
5. `src/screens/_mock/ProductMockScreen.jsx`
6. `src/screens/SetupProfileScreen.jsx`
7. `src/screens/AuthScreen.jsx`
8. `src/screens/RetailSettingsScreen.jsx`
9. `src/screens/OnboardingScreen.jsx`
10. `src/screens/ScanScreen.jsx`

Также затронуты:

- `src/components/BottomNav.jsx`
- `src/components/RetailBottomNav.jsx`
- `src/layouts/RetailLayout.jsx`
- `src/components/ConfirmDangerModal.jsx`
- `src/components/SyncResolveModal.jsx`
- `src/screens/StorePublicScreen.jsx`
- `src/screens/UnifiedProductScreen.jsx`

### 4. PWA-слой тоже зависит от темы

- `index.html` содержит тёмные `meta theme-color`.
- `vite.config.js` задаёт тёмный `background_color` и фиолетовый `theme_color` для manifest.

Следствие: одной сменой CSS задачу не закрыть. Нужно обновлять браузерный chrome / standalone-PWA experience.

### 5. Retail и Scanner требуют отдельной стратегии

- `RetailLayout` и `RetailBottomNav` используют собственную blue-tinted dark-палитру.
- Scanner-flow исторически тесно связан с тёмной средой и камерой.

Это кандидат на отдельные правила:

- либо theme-aware scanner shell,
- либо осознанный dark-first exception внутри light mode,
- либо гибридный вариант с сохранением тёмной камеры и светлого surrounding UI.

---

## Главные архитектурные риски

1. Нельзя ограничиться заменой нескольких CSS-переменных — слишком много inline dark-зависимостей.
2. Есть риск визуальной фрагментации: часть экранов станет светлой, а модалки/nav/layout останутся тёмными.
3. Есть риск регресса контраста и читаемости в сканере, карточке товара и retail-кабинете.
4. Есть риск, что настройка темы появится в UI раньше, чем будут покрыты все ключевые маршруты.
5. Есть риск сломать PWA-ощущение, если не синхронизировать `theme-color`, manifest и safe-area surfaces.

---

## Продуктовые решения, которые нужно согласовать перед implementation plan

Часть решений уже подтверждена владельцем:

1. `Light Premium` входит в обязательный V1 scope.
2. Светлая тема должна покрывать весь продукт.
3. В профиле остаётся ручной переключатель `Light / Dark`.
4. Системная тема устройства — допустимый initial value до первого явного выбора.
5. При переключении тем нужна красивая анимация/эффект, но без тяжёлой нагрузки на устройство.
6. Scanner желательно делать полноценным theme-aware, не откладывая это по умолчанию.
7. Шрифты сохраняются текущие: `Advent Pro` + `Inter`.
8. Идентичность важнее экспериментов: light должна ощущаться как тот же Körset, а не как другое приложение.
9. Glassmorphism сохраняется в обеих темах.

Открытыми остаются более узкие implementation-вопросы:

### 1. Scope depth

Светлая тема должна покрыть:

- только consumer-flow;
- consumer-flow + auth/setup;
- весь продукт, включая retail cabinet.

### 2. Behavior model in UI

Подтверждено: `System / Light / Dark` не нужен. Целевая модель — `Light / Dark`, где system определяет только initial value до первого выбора пользователя.

### 3. Persistence

Нужно выбрать источник сохранения:

1. Только `localStorage` на устройстве
2. `localStorage` + sync в профиль пользователя

Для V1 локальное хранение всё ещё выглядит безопаснее: меньше side effects, нет изменений БД/миграций, проще rollout и rollback.

### 4. Scanner exception

Нужно решить, будет ли scanner:

1. полностью theme-aware;
2. всегда dark-first даже в light mode;
3. гибридным экраном: светлый surrounding UI + тёмная camera zone.

Предварительное решение владельца: целиться в вариант `1`, а гибрид использовать только как fallback при реальном риске поломки/деградации UX.

---

## Рекомендуемое направление на текущий момент

На основании текущей архитектуры и рисков разумный V1 выглядит так:

1. Не удалять dark-theme и не менять её роль по умолчанию без явного решения владельца.
2. Добавить dual-theme foundation на CSS custom properties + `data-theme`.
3. Сначала перевести инфраструктурный слой (root/layout/nav/buttons/cards/forms/modals).
4. Затем по очереди переводить тяжёлые пользовательские экраны.
5. Scanner рассматривать отдельно и не обещать автоматически “полностью светлую камеру”.
6. Persistence для V1 держать локальной, без Supabase-изменений, если владелец не попросит cloud sync.
7. Онбординг-пивот не реализовывать параллельно со светлой темой, но не инвестировать лишнее время в polish обязательного `OnboardingScreen`, который уже переведён в отдельный roadmap.
8. Customer и retail должны сохранить текущую структуру сходства: общий визуальный язык, но с лёгкой разницей по акцентам, как в нынешней dark-версии.

---

## Что должно войти в будущий implementation plan

1. Theme architecture: tokens, semantics, provider/init script, persistence.
2. Shared shells: app frame, layouts, navs, cards, buttons, inputs, headers, overlays.
3. Consumer screens batch 1.
4. Consumer screens batch 2.
5. Retail batch.
6. PWA/browser theme-color integration.
7. Regression checklist + visual QA matrix.

План ещё не финализирован. Он будет составлен после ответа пользователя на продуктовые вопросы по scope/default/persistence.
