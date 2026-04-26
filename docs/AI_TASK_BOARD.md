# AI Task Board — Körset

Обновляется перед началом и после завершения задачи.

Статусы: planned / in_progress / blocked / review / done

## Правила

- одновременно максимум 2 задачи в статусе `in_progress` из разных write-zone
- если зоны пересекаются — активна только одна
- shared files (i18n, contexts, App, routing) — только Codex

## Tasks

### KOR-GLM-001
- owner: GLM 5.1
- status: done

### KOR-CODEX-001
- owner: Codex
- status: planned
- scope: интеграция import/data flow, верификация, контекст, тесты
- write_zone: tests/**, docs/CONTEXT.md, docs/vault/**, shared glue files
- notes: После GLM или параллельно, если write-zone не пересекается

### KOR-KIMI-001
- owner: Kimi 2.6
- status: done
- scope: Typography system: Advent Pro + Inter, CSS vars, refactor 6 screens
- write_zone: src/screens/**, src/components/**, src/index.css
- notes: Зона свободна. Следующий UI-task: KOR-KIMI-002

### KOR-GLM-002
- owner: GLM 5.1
- status: cancelled
- scope: merged into KOR-GLM-001
- write_zone: supabase/migrations/**, perf/data files
- notes: Объединено с KOR-GLM-001 для эффективности

### KOR-KIMI-002
- owner: Kimi 2.6
- status: planned
- scope: consumer polish — name_kz, smart merge UI, visual consistency
- write_zone: src/screens/**, src/components/**, src/index.css
- notes: ProductScreen redesign — integration of nutrition/diet components
