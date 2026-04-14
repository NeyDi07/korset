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

- [ ] ⚠️ **[НУЖНО ВРУЧНУЮ] SQL-патч в Supabase** — RLS fix + seed test store.
  ```sql
  DROP POLICY IF EXISTS "stores_read" ON stores;
  CREATE POLICY "stores_read_active" ON stores FOR SELECT USING (is_active = TRUE);
  INSERT INTO stores (code, name, city, address, type, plan, is_active)
  VALUES ('store-one', 'Магазин 1', 'Усть-Каменогорск', 'Тестовый магазин Körset', 'supermarket', 'pilot', TRUE)
  ON CONFLICT (code) DO NOTHING;
  ```

- [ ] ⚠️ **[Phase 2] Удалить `products.json` и `storeInventories.js`** — после миграции scan flow на Supabase.

---

## � ФАЗА 1: Retail Dashboard — Глубокая аналитика *(2–3 часа)*

- [ ] **[RetailDashboard] Реальные данные сканирований**
  COUNT из `scan_events` за 7 / 30 дней, фильтр по `store_id`.
  > 🤖 Модель: **Sonnet / Gemini Pro (High)**

- [ ] **[RetailDashboard] Топ-5 сканируемых товаров**
  GROUP BY `ean`, COUNT → JOIN `global_products` (название + фото).
  > 🤖 Модель: **Sonnet / Gemini Pro (High)**

- [ ] **[RetailDashboard] «Упущенная выгода» (killer-фича)**
  Товары, которые покупатели сканировали, но в `store_products` они либо `stock_status='out_of_stock'`, либо вообще отсутствуют. Список с названием и фото — мотивирует пополнять запасы. Главный B2B-аргумент при питче.
  > 🤖 Модель: **Sonnet (Thinking)** — нетривиальный LEFT JOIN с агрегацией.

- [ ] **[RetailBottomNav] Убрать вкладку Import**
  Import переезжает в скрытую admin-зону `/admin/`. Из retail-навигации убрать.
  > 🤖 Модель: **Gemini Pro (Low)**

---

## 🗂️ ФАЗА 2: Retail Products — Управление + Встроенный сканер *(3–4 часа)*

- [ ] **[RetailProducts] Данные из Supabase**
  Список через `getStoreCatalogProducts(currentStore.slug)`, не хардкод.
  > 🤖 Модель: **Sonnet**

- [ ] **[RetailProducts] Встроенный сканер в Sticky Header**
  Кнопка камеры рядом с поиском → `html5-qrcode` в мини-режиме → при скане EAN: автоскролл к карточке + автораскрытие аккордеона.
  > 🤖 Модель: **Sonnet** — интеграция сканера.

- [ ] **[RetailProducts] Умный поиск**
  Единый инпут: поиск по названию AND по штрихкоду одновременно.
  > 🤖 Модель: **Gemini Pro (Low)**

- [ ] **[RetailProducts] Accordion-редактор карточки**
  - Цена (₸) → UPDATE `store_products.price`
  - Premium Toggle наличие (iOS-like) → UPDATE `store_products.stock_status`
  - Полка / расположение → UPDATE `store_products.shelf` (stub-ready визуально, но уже сохранять в Supabase)
  - ⚠️ Редактировать только store-свойства. `global_products` (состав, фото) — readonly.
  > 🤖 Модель: **Sonnet / Gemini Pro (High)**

- [ ] **[RetailProducts] Оптимистичные обновления**
  Instant UI feedback при изменении цены/наличия + rollback при ошибке Supabase.
  > 🤖 Модель: **Sonnet**

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
