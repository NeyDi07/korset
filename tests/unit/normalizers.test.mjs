// Regression tests для normalizers.js — маппинг внешних источников (OFF/cache/global)
// в наш домен. Любая регрессия здесь = пропуск аллергена для пользователя.
//
// История багов, ради которых эти тесты:
//   • OFF_ALLERGEN_MAP в normalizers.js был дубликатом и расходился с allergens.js:
//     - 'en:nuts' → 'nuts' вместо 'tree_nuts' (фундук в шоколаде → safe)
//     - 'en:crustaceans' → 'shellfish' вместо 'crustaceans' (креветки → safe)
//     - 'en:molluscs', 'en:sesame-seeds', 'en:celery', 'en:mustard',
//       'en:lupin', 'en:sulphur-dioxide-and-sulphites' — вообще не покрывались
//   В сумме >50% обязательных по ТР ТС 022/2011 аллергенов терялось.

import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeOFFProduct } from '../../src/domain/product/normalizers.js'
import { ALLERGENS } from '../../src/constants/allergens.js'

// Helper
const off = (allergensTags = [], extra = {}) =>
  normalizeOFFProduct('1234567890123', {
    product_name: 'Test',
    allergens_tags: allergensTags,
    traces_tags: [],
    ...extra,
  })

// ─── Все 14 ТР ТС аллергенов из OFF корректно маппятся ──────────

const OFF_TO_DOMAIN_CASES = [
  { off: 'en:milk', expected: 'milk' },
  { off: 'en:gluten', expected: 'gluten' },
  { off: 'en:wheat', expected: 'gluten' }, // alias через зерно
  { off: 'en:eggs', expected: 'eggs' },
  { off: 'en:peanuts', expected: 'peanuts' },
  { off: 'en:nuts', expected: 'tree_nuts' }, // НЕ 'nuts' (legacy)
  { off: 'en:soybeans', expected: 'soy' },
  { off: 'en:soy', expected: 'soy' }, // alias
  { off: 'en:fish', expected: 'fish' },
  { off: 'en:crustaceans', expected: 'crustaceans' }, // НЕ 'shellfish'
  { off: 'en:molluscs', expected: 'mollusks' },
  { off: 'en:sesame-seeds', expected: 'sesame' },
  { off: 'en:celery', expected: 'celery' },
  { off: 'en:mustard', expected: 'mustard' },
  { off: 'en:lupin', expected: 'lupin' },
  { off: 'en:sulphur-dioxide-and-sulphites', expected: 'sulfites' },
]

OFF_TO_DOMAIN_CASES.forEach(({ off: tag, expected }) => {
  test(`normalizeOFFProduct: ${tag} → ${expected}`, () => {
    const product = off([tag])
    assert.deepEqual(product.allergens, [expected])
  })
})

// ─── Все ID, на которые маппятся OFF, должны существовать в ALLERGENS ───

test('every domain ID returned by OFF mapper is registered in ALLERGENS list', () => {
  const known = new Set(ALLERGENS.map((a) => a.id))
  // Дополнительные ID допустимы только если они переопределены через ALLERGEN_MIGRATION_MAP
  const expected = new Set(OFF_TO_DOMAIN_CASES.map((c) => c.expected))
  for (const id of expected) {
    assert.ok(known.has(id), `OFF mapper returns "${id}", but ALLERGENS list doesn't include it`)
  }
})

// ─── Множественные аллергены ────────────────────────────────────

test('multiple allergens preserved without duplicates', () => {
  const r = off(['en:milk', 'en:eggs', 'en:nuts'])
  assert.deepEqual(r.allergens.sort(), ['eggs', 'milk', 'tree_nuts'])
})

test('duplicate OFF tags collapse to single domain ID', () => {
  // en:nuts + en:tree-nuts оба → tree_nuts; не должно быть дублей
  const r = off(['en:nuts', 'en:nuts'])
  assert.deepEqual(r.allergens, ['tree_nuts'])
})

// ─── Traces — тот же маппинг ───────────────────────────────────

test('traces_tags use same canonical mapping (no legacy IDs)', () => {
  const r = normalizeOFFProduct('1', {
    product_name: 't',
    allergens_tags: [],
    traces_tags: ['en:nuts', 'en:crustaceans'],
  })
  assert.deepEqual(r.traces.sort(), ['crustaceans', 'tree_nuts'])
})

// ─── Edge: пустой массив, неизвестные теги ────────────────────

test('empty allergens_tags → empty allergens array', () => {
  const r = off([])
  assert.deepEqual(r.allergens, [])
})

test('unknown OFF tag is silently dropped (not crash, not "undefined")', () => {
  const r = off(['en:something-not-mapped', 'en:milk'])
  assert.deepEqual(r.allergens, ['milk'])
})
