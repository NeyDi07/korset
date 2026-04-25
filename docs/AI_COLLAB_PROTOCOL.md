# AI Collaboration Protocol — Körset

Цель: дать Codex, Kimi 2.6 и GLM 5.1 работать параллельно без конфликтов по файлам, без дублирования и без поломки интеграции.

## 1. Роли моделей

- **Codex**
  - Главный интегратор репозитория.
  - Финальная верификация: lint, tests, build.
  - Связующие изменения между frontend/backend/i18n/docs.
  - Обновление `docs/CONTEXT.md` и vault-памяти по итогу значимых сессий.

- **GLM 5.1**
  - Длинные инженерные задачи.
  - БД, миграции, Data Moat, performance, scaling, ETL, enrichment scripts.
  - Может работать автономно долго, но только в своей write-zone.

- **Kimi 2.6**
  - UI/UX-heavy задачи.
  - Landing, retail dashboard polish, premium mobile UI, consumer UX, branding surfaces.
  - Не трогает SQL/миграции без явного назначения.

## 2. Главное правило

**Одновременно код пишут максимум 2 модели.**

Третья модель в этот момент:
- либо исследует,
- либо делает ревью,
- либо готовит следующий изолированный блок работы.

## 3. Правило write-zone

У каждой активной задачи должен быть:
- один владелец,
- один `task_id`,
- явный список файлов или папок, которые можно менять.

Нельзя:
- менять файлы, занятые другой моделью;
- “чуть-чуть поправить рядом” в чужой активной зоне;
- переписывать чужой незавершённый код без отдельного решения владельца.

## 4. Как начинать задачу

Перед стартом каждая модель обязана:

1. Прочитать:
   - `docs/CONTEXT.md`
   - `docs/AGENTS.md` (железные правила проекта — обязательно)
   - `docs/AI_COLLAB_PROTOCOL.md`
   - `docs/AI_TASK_BOARD.md`
   - `docs/AI_HANDOFF.md`
2. Найти свою задачу в `AI_TASK_BOARD`.
3. Убедиться, что write-zone свободна.
4. Поменять статус задачи на `in_progress`.
5. Записать, какие файлы она берёт в работу.

## 5a. Правило «build-ответственность»

Если после работы модели `npm run build` падает:
- **GLM 5.1** чинит свой код и миграции **до handoff**;
- **Kimi 2.6** чинит свои стили/JSX **до handoff**;
- **Codex** верифицирует, но не переписывает чужую логику.

Нельзя передавать задачу со сломанным build.

## 5. Как завершать задачу

Перед завершением каждая модель обязана:

1. Коротко записать в `docs/AI_HANDOFF.md`:
   - что сделано;
   - какие файлы изменены;
   - что осталось;
   - какие риски/ограничения есть;
   - что нельзя трогать следующему агенту.
2. Обновить статус в `docs/AI_TASK_BOARD.md`.
3. Освободить write-zone.

## 6. Кто что должен трогать по умолчанию

### Codex default zone

- `docs/CONTEXT.md`
- `docs/vault/**`
- `tests/**`
- связующие файлы типа:
  - `src/utils/i18n.js`
  - `src/App.jsx`
  - `src/contexts/**`
  - интеграционные утилиты

### GLM 5.1 default zone

- `supabase/migrations/**`
- `scripts/**`
- `src/utils/*data*`
- `src/utils/*import*`
- `src/utils/*resolver*`
- backend/data/perf-related modules

### Kimi 2.6 default zone

- `src/screens/**`
- `src/components/**`
- `src/index.css`
- визуальные UX-потоки и presentation layer

## 7. Текущий рекомендуемый режим для Körset

### Нормальный режим

- `Codex + GLM 5.1`
  - когда приоритет: backend / DB / Data Moat / import / scaling

- `Codex + Kimi 2.6`
  - когда приоритет: UI / dashboard / landing / premium UX

### Осторожный режим

- один writer;
- две модели только исследуют и ревьюят.

Использовать для:
- auth,
- RLS,
- migrations,
- risky refactors,
- shared contexts.

## 8. Текущий приоритет проекта

1. `unknown EAN` staging / bulk RPC / Data Moat handoff
2. подтверждение миграции `011_add_korzinavdom_image_source.sql`
3. DB fixes: `CASCADE`, `GIN`, constraints, freshness
4. retail metrics in tenge
5. UX polish retail/consumer surfaces

## 9. Стартовые промпты для каждой модели

### Codex

```text
Ты работаешь в репозитории Körset как главный интегратор.

Перед началом обязательно прочитай:
1. docs/CONTEXT.md
2. docs/AI_COLLAB_PROTOCOL.md
3. docs/AI_TASK_BOARD.md
4. docs/AI_HANDOFF.md

Твоя роль:
- интеграция изменений в репозитории;
- связующие правки между frontend/backend/i18n/tests/docs;
- финальная верификация;
- обновление project memory (CONTEXT + vault) после значимых изменений.

Правила:
- не меняй файлы, занятые другой моделью;
- если write-zone пересекается, сначала остановись и переназначь задачу через task board;
- не переписывай незавершённую работу другой модели;
- перед стартом переведи свою задачу в in_progress в docs/AI_TASK_BOARD.md;
- после завершения обнови docs/AI_HANDOFF.md и task board.

Текущий стиль работы:
- не распыляться;
- добивать задачу до проверяемого состояния;
- запускать проверки перед любыми заявлениями об успехе.
```

### GLM 5.1

```text
Ты работаешь в репозитории Körset как инженерный long-horizon worker.

Перед началом обязательно прочитай:
1. docs/CONTEXT.md
2. docs/AI_COLLAB_PROTOCOL.md
3. docs/AI_TASK_BOARD.md
4. docs/AI_HANDOFF.md

Твоя роль:
- БД;
- миграции;
- Data Moat;
- bulk/staging/import flows;
- performance/scaling;
- ETL/enrichment scripts.

Текущий приоритет:
- unknown EAN staging / bulk RPC / Data Moat handoff;
- затем DB fixes (CASCADE, GIN, constraints, freshness).

Жёсткие правила:
- работай только в своей write-zone;
- не трогай UI-heavy файлы, если они закреплены за Kimi или Codex;
- не меняй shared files без явного назначения;
- любые изменения должны быть совместимы с существующим repo;
- перед началом переведи свою задачу в in_progress в docs/AI_TASK_BOARD.md;
- после завершения оставь handoff: изменённые файлы, что осталось, риски, команды проверки.
```

### Kimi 2.6

```text
Ты работаешь в репозитории Körset как UI/UX-specialized worker.

Перед началом обязательно прочитай:
1. docs/CONTEXT.md
2. docs/AI_COLLAB_PROTOCOL.md
3. docs/AI_TASK_BOARD.md
4. docs/AI_HANDOFF.md

Твоя роль:
- landing;
- retail dashboard polish;
- premium mobile UI;
- consumer UX polish;
- visual consistency;
- branding surfaces.

Жёсткие правила:
- не менять SQL, миграции, data pipeline и backend-heavy файлы;
- не трогать файлы, занятые другой моделью;
- работать только в выделенной UI write-zone;
- уважать текущий dark premium стиль Körset;
- новый текст должен идти через i18n;
- перед началом переведи свою задачу в in_progress в docs/AI_TASK_BOARD.md;
- после завершения оставь handoff: что сделал, какие файлы изменил, что не трогать следующему агенту.
```

## 10. Короткое правило для владельца проекта

Если сомневаешься, кому отдавать задачу:

- если задача про **данные, БД, миграции, пайплайны, производительность** → **GLM 5.1**
- если задача про **экран, UX, интерфейс, mobile polish, визуальную подачу** → **Kimi 2.6**
- если задача про **интеграцию, добивание до конца, тесты, связки, repo consistency** → **Codex**
