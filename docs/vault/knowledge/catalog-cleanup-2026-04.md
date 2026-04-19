# Catalog Cleanup — 2026-04-19

## Проблема
56% продуктов (385/685) имели английские названия. Состав — 52% на английском. Фото — с Open Food Facts (низкое качество). Данные не адаптированы для казахстанского рынка.

## Решение

### Починенные скрипты
- **npc-enrich.cjs**: +`--fix-names` режим, source_primary='npc' (было 'kz_verified'), раздельные name/EAN апдейты (решает duplicate EAN)
- **arbuz-enrich.cjs**: +обновление name/name_kz из Arbuz, source_primary='arbuz', `--fix-names`, search by name when brand<2, data_quality_score
- **usda-enrich.cjs**: Vercel proxy вместо прямого USDA API, source_primary='usda'

### Новые скрипты
- **arbuz-import.cjs**: Arbuz-first pipeline — загружает каталог Arbuz по категориям, создаёт global_products, матчит с NPC/OFF
- **add-category-prefix.cjs**: prepend русской категории к англ. именам ("Чипсы — Doritos")
- **audit-catalog.cjs**: аудит качества каталога (имена, состав, name_kz, image_source, etc.)

### Результаты enrichment

| Метрика | Было | Стало |
|---------|------|-------|
| Англ. имена | 385 (56.2%) | 2 (0.3%) |
| Пустой name_kz | 554 (80.9%) | 171 (25%) |
| source_primary=npc | 0 | 359 |
| source_primary=openfoodfacts | 382 | 28 |

### Порядок pipeline (новый)
1. Arbuz — primary source (арбузовские русские имена, фото, состав, халал)
2. NPC — enrichment (GTIN, NTIN, nameRu/nameKk, OKTRU)
3. USDA — fallback состав/КБЖУ (через Vercel proxy)
4. Kaspi — fallback цена/состав
5. OFF — аллергены/NutriScore

### Деплой
- api/usda.js задеплоен на Vercel (USDA_API_KEY добавлен)
- VERCEL_TOKEN в .env.local
