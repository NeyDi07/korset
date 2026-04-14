# 🎯 KÖRSET — RETAIL CABINET: ПОЛНЫЙ РЕФАКТОРИНГ

> Roadmap согласован 2026-04-14. Работаем поэтапно — одна фаза за сессию.
> Отмечай: `[ ]` → `[x]`
> Подробная архитектура каждой фазы — в `KORSET_ULTIMATE.md` (Раздел 17).

---

## ✅ ЗАВЕРШЕНО (baseline до рефакторинга)

- [x] ScanScreen: memory leak AudioContext + замена SVG-иконок → Material Symbols
- [x] App.jsx: убраны дублирующие роуты без storeSlug → редиректы
- [x] ProfileContext: защита кэша при плохом интернете
- [x] Локализация: хардкод-строки → i18n.js
- [x] Privacy Policy экран (`/privacy-policy`)
- [x] Onboarding: юридический дисклеймер ИИ
- [x] HistoryScreen: синхронизация с Supabase (scan_events)
- [x] Избранное: стабильная работа с user_favorites
- [x] Smart Merge: SyncResolveModal при конфликте локал/облако
- [x] Retail Cabinet v1 skeleton (Dashboard, Products, Import, Settings, RetailLayout)

---

## ✅ ФАЗА 0: Фундамент данных *(выполнено)*

- [x] **[StoreContext] Магазины из Supabase**
  `StoreContext.jsx` переписан: загрузка из `stores` Supabase + localStorage cache. Нормализация `code → slug`. Поддержка `/retail/:storeSlug/` в path parser. `isStoreLoading` в контексте.

- [x] **[storeCatalog.js] Async Supabase функция**
  Добавлена `getStoreCatalogProductsFromDB(storeId)` — JOIN `store_products` + `global_products`. Старые sync функции сохранены для scan flow до Phase 2.

- [x] **[RetailLayout] RBAC — реальная проверка роли**
  Проверка `stores.owner_id === user.id` OR `role = 'admin'`. `NoAccessScreen` инлайн. `isStoreLoading` guard.
  Бонус: SVG-иконка заменена на Material Symbols `storefront`.

- [x] **Удаление мусора** — `src/scr.md`, `src/screens/screens.md`, `src/components/.venv/`

- [x] **Миграция экранов** — `StoresScreen`, `StorePublicScreen` → Supabase/useStore()

- [x] ⚠️ **[НУЖНО ВРУЧНУЮ] SQL-патч в Supabase** — RLS fix + seed test store. *(выполнено пользователем)*
  ```sql
  DROP POLICY IF EXISTS "stores_read" ON stores;
  CREATE POLICY "stores_read_active" ON stores FOR SELECT USING (is_active = TRUE);
  INSERT INTO stores (code, name, city, address, type, plan, is_active)
  VALUES ('store-one', 'Магазин 1', 'Усть-Каменогорск', 'Тестовый магазин Körset', 'supermarket', 'pilot', TRUE)
  ON CONFLICT (code) DO NOTHING;
  ```

- [x] **DevTools** — ESLint + Prettier + Husky + lint-staged, `@tanstack/react-query`, Playwright — конфиг + 4 базовых e2e теста

- [ ] ⚠️ **[Phase 2] Удалить `products.json` и `storeInventories.js`** — после миграции scan flow на Supabase.

---

## ✅ Сессия 4 — Landing Entry + DevTools

- [x] `RetailEntryScreen.jsx` — роут `/retail`, автоматический поиск магазина по `owner_id`
- [x] PILOT MODE: RBAC отключён, ищет первый активный магазин
- [x] `HomeScreen.jsx` — кнопка "Кабинет" в nav + B2B секция

---

## ✅ ФАЗА 1: Retail Dashboard — Глубокая аналитика *(ЗАВЕРШЕНО)*

- [x] **[RetailDashboard] Реальные данные сканирований**
  `getScansCount(storeId, days)` — COUNT из `scan_events` за 7/30 дней.
  `getUniqueProductsScanned(storeId, days)` — уникальные EAN.
  `getTotalProducts(storeId)` — COUNT из `store_products`.
  Все через React Query + skeleton loading.

- [x] **[RetailDashboard] Топ-5 сканируемых товаров**
  RPC `get_top_scanned_products(p_store_id, p_days_back, p_limit)` → GROUP BY ean, COUNT → JOIN global_products.
  `ProductRow` с рангом, фото, названием, счётчиком.

- [x] **[RetailDashboard] «Упущенная выгода» (killer-фича)**
  RPC `get_missed_opportunities(p_store_id, p_days_back)` — LEFT JOIN scan_events + store_products.
  Причина: `not_in_catalog` / `out_of_stock`. Фильтр-табы: Все / Нет в каталоге / Нет в наличии.
  `MissedRow` с цветным бейджем причины.

- [x] **[RetailBottomNav] Убрать вкладку Import**
  3 таба: Dashboard / Products / Settings. Import убран из навигации.

- [x] **[retailAnalytics.js] Все функции аналитики**
  `getScansCount`, `getUniqueProductsScanned`, `getTotalProducts`, `getTopScannedProducts`, `getMissedOpportunities`, `getStoreCatalogProducts`, `updateProductPrice`, `updateProductStock`.

- [x] **[supabase_retail_analytics.sql] RPC-функции**
  `get_top_scanned_products` + `get_missed_opportunities`. SECURITY DEFINER.

---

## ✅ ФАЗА 2: Retail Products — Управление + Встроенный сканер *(ЗАВЕРШЕНО)*

### ✅ 2.1 — Data Layer + реальные данные

- [x] `getStoreCatalogProducts(storeId)` в `retailAnalytics.js` — JOIN store_products + global_products
- [x] `useQuery(['retail-products', storeId])` + skeleton loading (6 строк)
- [x] Оптимистичные обновления: `useMutation` для цены (setQueryData) и стока (rollback onError)
- [x] `PriceField`: save-on-blur, состояния idle/saving/saved/error
- [x] `StockToggle`: iOS-like toggle, optimistic + rollback
- [x] `StockBadge`: in_stock / low_stock / out_of_stock с цветами
- [x] i18n строки для всех retail-элементов

### ✅ 2.2 — Поиск + UX шапки

- [x] Material Symbols иконки в шапке (search, close, barcode_scanner, expand_more)
- [x] Умный поиск: название + бренд + EAN одновременно
- [x] `Highlight` компонент — подсветка совпадений cyan-цветом
- [x] Счётчик `X / Y` при активном поиске
- [x] Кнопка очистки поиска (×)

### ✅ 2.3 — Встроенный сканер

- [x] `html5-qrcode` уже установлен (v2.3.8)
- [x] Кнопка камеры в шапке → полноэкранный модал `RetailScannerModal.jsx`
- [x] Lazy import html5-qrcode, viewfinder-оверлей с анимацией линии
- [x] Фонарик + переключение камер + обработка ошибок разрешений
- [x] После скана: закрыть модал, найти товар по EAN → раскрыть аккордеон + toast
- [x] Fallback: красный toast «Нет в каталоге» если EAN не найден

### ✅ 2.4 — Accordion-редактор (polish)

- [x] Shelf / расположение поле → `updateProductShelf(id, shelf)` → Supabase
- [x] Readonly блок с данными из `global_products` (состав, фото, бренд, категория)
- [x] Кнопка «Сохранить» с состояниями: idle / saving / saved / error (для shelf)
- [x] Анимация раскрытия аккордеона через CSS height transition *(использован grid-template-rows 0fr/1fr)*

### ✅ Синхронизация (дополнительно)

- [x] `CatalogScreen.jsx`: React Query + fallback Supabase → local JSON
- [x] `StoreContext.jsx`: `fetchStoreBySlug` fallback на `getStoreBySlug()`
- [x] `StoresScreen.jsx`: fallback на `getStores()`
- [x] `supabase_sync_test_products.sql`: 16 реальных товаров + store-one, идемпотентен
  - ⚠️ **Нужно выполнить вручную в Supabase Dashboard → SQL Editor**

---

## ⚙️ ФАЗА 3: Retail Settings — Премиальный кабинет управления *(1.5–2 часа)*

- [ ] **Секция «Основное»**
  Инпуты: название точки, фактический адрес, описание → UPDATE `stores` в Supabase.

- [ ] **Секция «Оформление (Visuals)»**
  Upload-зоны для логотипа и баннера/обложки магазина → реальная загрузка в Supabase Storage (Storage уже используется для аватаров — паттерн готов). Это то, что покупатель видит при входе по QR.

- [ ] **Секция «Уведомления»**
  Тумблеры: ежедневный отчёт, push-уведомления о ненайденных товарах.

- [ ] Убрать всё лишнее из текущего экрана (часы работы, карты и пр.).

  > 🤖 Модель: **Sonnet / Gemini Pro (High)** — новый экран с нуля.

---

## 🧹 ФАЗА 4: Финальная чистка *(1 час)*

- [ ] **[RetailLayout] SVG-иконка → Material Symbols** (нарушение дизайн-правил)
- [ ] **Retail строки → i18n.js** — все хардкод-строки RU/KZ
- [ ] **[App.jsx] Lazy loading** — `React.lazy()` + `Suspense` для всех экранов
- [ ] **[App.jsx] Import** `UserDataProvider` перенести на верх файла (сейчас между компонентом и export)
- [ ] **UserDataContext.jsx** переместить из `src/screens/` в `src/contexts/`
- [ ] **[ErrorBoundary] Улучшить fallback-UI** в стиле Dark Premium

  > 🤖 Модель: **Gemini Pro (Low)** — механические правки.

---

## 🚀 ФАЗА 5: Подготовка к пилоту

- [ ] **QR-баннеры:** Макеты для физических QR-точек (баннер у входа, наклейка, касса, полки)
- [ ] **Данные первого магазина:** Финальный прайс-лист → `global_products` + `store_products` в Supabase
- [ ] **Инструкция для продавцов:** 1-страничный скрипт «Как рекомендовать Körset покупателю»

---

*V2 (Stories, карта, дашборд здоровья, загрузка фото из галереи, Self-Service B2B) — сюда не попадают.*
