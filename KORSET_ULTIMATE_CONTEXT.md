# 🚀 KÖRSET — БЫСТРЫЙ КОНТЕКСТ (для начала каждой сессии)

> **Для ИИ-ассистента:** Это краткая выжимка для быстрого старта. Для глубокого погружения читай `KORSET_ULTIMATE.md`. Если данные противоречат — `KORSET_ULTIMATE.md` имеет приоритет.

---

## ⚡ ШАБЛОН СТАРТА НОВОЙ СЕССИИ

**Минимальный промпт для нового чата:**

```
Читай KORSET_ULTIMATE_CONTEXT.md, TODO_V1.md и последние 2 записи CHANGELOG.md.
Задача: [опиши задачу одной строкой]
```

---

## Что такое Körset
**Store-context AI assistant** (mobile-first PWA) для офлайн-магазинов Казахстана.
Покупатель сканирует штрихкод → получает **Fit-Check** (подходит товар или нет) с учётом аллергий, Халал, диеты.
**Бизнес-модель B2B2C:** платят магазины (~15 000 тг/мес SaaS). Körset — инструмент роста продаж и вовлечённости для ритейла.

---

## Стек
| | |
|---|---|
| **Frontend** | React 18 + Vite + JavaScript (SPA) |
| **Backend** | Supabase (PostgreSQL, Auth, Storage) |
| **Стиль** | Dark Premium Glassmorphism, Vanilla CSS |
| **Шрифты** | `Advent Pro` (заголовки), `Manrope` (текст) |
| **Иконки** | **Только** `Material Symbols Outlined` (Google Fonts) |
| **Роутинг** | react-router-dom v6 |
| **i18n** | `useI18n` → `src/utils/i18n.js` (RU/KZ обязательно) |
| **Deploy** | Vercel + GitHub (`Korset-App/korset`, публичный репо) |
| **Качество кода** | ESLint + Prettier + Husky + lint-staged |
| **Тесты** | Playwright (e2e, `tests/e2e/`) |
| **Data fetching** | `@tanstack/react-query` (установлен, Фаза 1+) |

---

## Ключевые маршруты
```
/                           → Лендинг
/stores                     → Список магазинов
/s/:storeSlug               → Главный экран магазина (store-home)
/s/:storeSlug/scan          → Сканер
/s/:storeSlug/catalog       → Каталог
/s/:storeSlug/product/:ean  → Карточка товара
/s/:storeSlug/history       → История
/s/:storeSlug/profile       → Профиль
/admin/rapid-scan           → Терминал оцифровки (RBAC: role=admin)
/retail                     → RetailEntryScreen (авто-поиск магазина по owner_id)
/retail/:storeSlug/...      → Retail Cabinet (dashboard, products, import, settings)
```

---

## Структура проекта

```
korset/
├── src/
│   ├── App.jsx                        # Корневой роутинг
│   ├── main.jsx                       # Точка входа
│   ├── index.css                      # Глобальные стили (Dark Premium)
│   │
│   ├── screens/                       # Экраны приложения
│   │   ├── HomeScreen.jsx             # Лендинг (/)
│   │   ├── StoresScreen.jsx           # Список магазинов (/stores)
│   │   ├── StorePublicScreen.jsx      # Публичная страница магазина
│   │   ├── OnboardingScreen.jsx       # Онбординг (в контексте магазина)
│   │   ├── ScanScreen.jsx             # Сканер штрихкодов ⚠️ memory leak
│   │   ├── ProductScreen.jsx          # Карточка товара
│   │   ├── UnifiedProductScreen.jsx   # Унифицированный экран товара
│   │   ├── ExternalProductScreen.jsx  # Внешний товар (OpenFoodFacts и др.)
│   │   ├── CatalogScreen.jsx          # Каталог товаров магазина
│   │   ├── AIScreen.jsx               # Чат с Körset AI (контекст = продукт)
│   │   ├── AIAssistantScreen.jsx      # Ассистент (общий)
│   │   ├── AlternativesScreen.jsx     # Альтернативные товары
│   │   ├── HistoryScreen.jsx          # История сканирований
│   │   ├── ProfileScreen.jsx          # Профиль пользователя
│   │   ├── SetupProfileScreen.jsx     # Настройка профиля + ?mode=edit
│   │   ├── AuthScreen.jsx             # Авторизация / Регистрация
│   │   ├── NotificationSettingsScreen.jsx  # Настройки уведомлений
│   │   ├── PrivacySettingsScreen.jsx  # Настройки приватности
│   │   └── QRPrintScreen.jsx          # Печать QR-кода магазина
│   │
│   ├── components/                    # Переиспользуемые компоненты
│   │   ├── ProfileAvatar.jsx          # ⚠️ ЕДИНСТВЕННЫЙ способ показать аватар
│   │   ├── BottomNav.jsx              # Нижняя навигация
│   │   ├── ErrorBoundary.jsx          # Обработка ошибок рендера
│   │   ├── ExpandToggle.jsx           # Раскрываемый блок
│   │   └── KorsetAvatar.jsx           # Аватар ИИ-ассистента
│   │
│   ├── contexts/                      # React Context (глобальное состояние)
│   │   ├── AuthContext.jsx            # Авторизация (Supabase Auth)
│   │   ├── ProfileContext.jsx         # Профиль пользователя ⚠️ кэш
│   │   ├── StoreContext.jsx           # Контекст текущего магазина
│   │   └── UserDataContext.jsx        # Данные пользователя (история, избранное)
│   │
│   ├── layouts/                       # Обёртки страниц
│   │   ├── AppLayout.jsx              # Лейаут Consumer App (с BottomNav)
│   │   ├── PublicLayout.jsx           # Лейаут публичных страниц
│   │   └── RetailLayout.jsx           # Лейаут Retail Cabinet
│   │
│   ├── utils/                         # Утилиты
│   │   ├── i18n.js                    # ВСЕ переводы RU/KZ (добавлять сюда!)
│   │   ├── routes.js                  # Хелперы маршрутов (через storeSlug)
│   │   ├── fitCheck.js                # Логика Fit-Check (детерминированный)
│   │   ├── supabase.js                # Клиент Supabase
│   │   ├── profile.js                 # Работа с профилем / localStorage
│   │   ├── userIdentity.js            # Идентификация гостя (device_id)
│   │   ├── localHistory.js            # История (localStorage)
│   │   ├── storeCatalog.js            # Работа с каталогом магазина
│   │   ├── productLookup.js           # Поиск товара по EAN
│   │   ├── authFlow.js                # Логика авторизации
│   │   ├── notificationSettings.js    # Настройки уведомлений
│   │   ├── privacySettings.js         # Настройки приватности
│   │   └── store.js                   # Работа с данными магазина
│   │
│   ├── services/
│   │   └── ai.js                      # Сервис вызова ИИ (Körset AI)
│   │
│   └── domain/product/                # Доменная логика товара
│
├── api/                               # Serverless API (Vercel Functions)
│   ├── ai.js                          # Endpoint для Körset AI
│   ├── off.js                         # OpenFoodFacts proxy
│   └── push/                          # Push-уведомления
│       ├── subscribe / unsubscribe
│       ├── send-test / send-event
│
├── KORSET_ULTIMATE.md                 # 📖 Главный источник правды (полная архитектура)
├── KORSET_ULTIMATE_CONTEXT.md         # ⚡ Этот файл (быстрый контекст)
├── CHANGELOG.md                       # 📋 Лог изменений по сессиям
├── KORSET_DB_SCHEMA_FULL.sql          # Схема БД (контекст)
├── supabase_schema.sql                # Боевая схема БД
└── supabase_push_notifications.sql    # SQL для Push
```

---

## Что уже работает
- ✅ Лендинг (Glassmorphism, Bottom Nav скрыт, якоря работают)
- ✅ Supabase Auth (вход/регистрация, Google OAuth)
- ✅ Онбординг 2-шаговый + Edit Mode (`?mode=edit`) + юридический дисклеймер ИИ
- ✅ ProfileAvatar (AI-пресеты + фото из Storage + fallback)
- ✅ Сканер штрихкодов (`html5-qrcode`, memory leak исправлен)
- ✅ AIScreen (чат с ИИ, привязан к продукту)
- ✅ Push-уведомления (Service Worker + VAPID + API endpoints)
- ✅ Rapid-Scan Admin (`/admin/rapid-scan`, RBAC)
- ✅ HistoryScreen → Supabase sync (`scan_events`)
- ✅ Избранное → `user_favorites` Supabase
- ✅ Smart Merge — SyncResolveModal при конфликте локал/облако
- ✅ Privacy Policy (`/privacy-policy`, RU/KZ)
- ✅ Retail Cabinet skeleton (Dashboard, Products, Import, Settings, RetailLayout + RetailBottomNav)
- ✅ StoreContext → Supabase (localStorage cache, isStoreLoading)
- ✅ RetailEntryScreen — `/retail` роут, авто-redirect по owner_id (PILOT: RBAC отключён)
- ✅ HomeScreen лендинг — кнопка "Кабинет" в nav + B2B секция
- ✅ Supabase: RLS policy `stores_read_active` активна, store-one засеян
- ✅ ESLint + Prettier + Husky + Playwright настроены

---

## Железные правила (кратко)
1. **Сначала анализ → потом код.** Предложи план → получи апрув → правь.
2. **Не ломать работающее** (особенно: Onboarding, роутинг, `useI18n`, `ProfileContext`).
3. **Экраны покупателя → только внутри `/s/:storeSlug/`.**
4. **Иконки только Material Symbols.** Никаких SVG.
5. **Аватары только `<ProfileAvatar />`.**
6. **Не переписывать стили** на светлые SaaS-шаблоны.
7. **Новый текст в UI → через `i18n.js`,** не хардкодить строки.
8. **Оценивай через B2B:** «Поможет ли это продать подписку магазину?»

---

## Текущий фокус — Retail Cabinet: Полный рефакторинг

> Детальный план с задачами → `TODO_V1.md` | Архитектура фаз → `KORSET_ULTIMATE.md` (Раздел 17)

| Фаза | Задача | Статус |
|------|--------|--------|
| **0** | Фундамент: магазины из Supabase, RBAC, удалить хардкод | ✅ Готово |
| **1** | Retail Dashboard: реальная аналитика + «Упущенная выгода» | ⏳ Следующая |
| **2** | Retail Products: сканер в шапке, данные Supabase, редактор | 🔜 |
| **3** | Retail Settings: управление магазином, логотип/баннер | 🔜 |
| **4** | Чистка: lazy loading, i18n, SVG→Material Symbols | 🔜 |
| **5** | Подготовка к пилоту: QR-баннеры, данные, инструкции | 🔜 |

## V2 — заморожено (не предлагать!)
Stories, карта магазинов, дашборд здоровья (графики), фото из галереи в сканер, Self-Service B2B портал.

---

*Подробная архитектура, AI-логика, бизнес-модель, roadmap → `KORSET_ULTIMATE.md`*
*Что было сделано в прошлых сессиях → `CHANGELOG.md`*
