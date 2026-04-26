# AI Handoff — Körset

Живая передача работы. Одна текущая запись, перезаписывается при завершении задачи.
Промпты для стартовых сессий → `docs/AI_COLLAB_PROTOCOL.md` секция 9.

---

## Current Handoff

Дата: 2026-04-25
Модель: GLM 5.1
Task ID: KOR-GLM-001

Сделано:
- Миграции 012-015 (unknown_ean_staging, CASCADE, GIN/tsvector, constraints)
- 3 RPC: bulk_update_store_products, stage_unknown_eans, resolve_unknown_eans
- data_quality_score функция + триггер на global_products
- source_updated_at колонка + backfill
- TTL enforcement в resolver.js (findCacheProduct)
- retailImport.js переведён на bulk RPC + staging + auto-resolve
- Скрипт resolve-unknown-eans.cjs (каскад: NPC→Arbuz→USDA→OFF)

Изменённые файлы:
- supabase/migrations/012_unknown_ean_staging.sql (новый)
- supabase/migrations/013_cascade_fk_fixes.sql (новый)
- supabase/migrations/014_gin_tsvector_indexes.sql (новый)
- supabase/migrations/015_constraints_and_enrichment.sql (новый)
- src/utils/retailImport.js (переписан applyRetailImport)
- src/domain/product/resolver.js (TTL enforcement)
- scripts/resolve-unknown-eans.cjs (новый)
- docs/AI_TASK_BOARD.md (KOR-GLM-001 in_progress, KOR-GLM-002 cancelled/merged)
- docs/CONTEXT.md (обновлён)

Проверено:
- npm run lint: 0 errors, 48 warnings (без новых)
- npm run build: OK
- npm test: 4/4
- node --test tests/unit/retailImportCore.test.mjs: 3/3

Осталось:
- **Применить миграции 011-015 через Supabase SQL Editor** (владелец проекта)
- Протестировать импорт прайс-листа end-to-end после применения миграций
- UI RetailImportScreen может нуждаться в обновлении для показа staged/autoResolved (зона Kimi)

Не трогать:
- src/screens/** (зона Kimi)
- src/components/** (зона Kimi)
- src/utils/i18n.js (зона Codex для shared)

Риски / замечания:
- Миграции 012-015 изменяют FK constraints — могут не примениться если есть осиротевшие записи. Нужно сначала проверить: `SELECT * FROM scan_events WHERE store_id NOT IN (SELECT id FROM stores)` и т.п.
- data_quality_score триггер пересчитает score при каждой INSERT/UPDATE — это OK но может замедлить batch upsert. Для batch скриптов可以考虑 временно отключать триггер.
- resolve_unknown_eans.cjs использует NPC API с rate limit — при больших объёмах (1000+ EAN) нужно --limit=50 и паузы.

---

## Handoff Template

```text
Дата:
Модель:
Task ID:

Сделано:
- ...

Изменённые файлы:
- ...

Проверено:
- ...

Осталось:
- ...

Не трогать:
- ...

Риски / замечания:
- ...
```
