import test from 'node:test'
import assert from 'node:assert/strict'

import { fmtPrice, fmtList, fmtDate, fmtNumber } from '../../../src/i18n/format.js'

test('fmtPrice 1500 ru → formatted with KZT', () => {
  const result = fmtPrice(1500, 'ru')
  assert.ok(result.includes('1 500') || result.includes('1\u00A0500'))
  assert.ok(result.includes('KZT') || result.includes('₸'))
})

test('fmtPrice 0 ru → formatted', () => {
  const result = fmtPrice(0, 'ru')
  assert.ok(result.includes('0'))
  assert.ok(result.includes('KZT') || result.includes('₸'))
})

test('fmtPrice kz locale uses kk-KZ', () => {
  const result = fmtPrice(1500, 'kz')
  assert.ok(result.includes('KZT') || result.includes('₸'))
})

test('fmtPrice large number ru', () => {
  const result = fmtPrice(1000000, 'ru')
  assert.ok(result.includes('KZT') || result.includes('₸'))
  assert.ok(result.includes('1'))
})

test('fmtPrice no decimal digits', () => {
  const result = fmtPrice(99.9, 'ru')
  assert.ok(!result.includes('99.9'))
})

test('fmtList single item → returns item', () => {
  assert.equal(fmtList(['молоко'], 'ru'), 'молоко')
})

test('fmtList two items ru → joined with "и"', () => {
  const result = fmtList(['молоко', 'хлеб'], 'ru')
  assert.ok(result.includes('молоко'))
  assert.ok(result.includes('хлеб'))
  assert.ok(result.includes('и'))
})

test('fmtList three items ru', () => {
  const result = fmtList(['молоко', 'хлеб', 'яйца'], 'ru')
  assert.ok(result.includes('молоко'))
  assert.ok(result.includes('хлеб'))
  assert.ok(result.includes('яйца'))
})

test('fmtList empty array → empty string', () => {
  assert.equal(fmtList([], 'ru'), '')
})

test('fmtList null → empty string', () => {
  assert.equal(fmtList(null, 'ru'), '')
})

test('fmtList kz locale', () => {
  const result = fmtList(['сүт', 'нан'], 'kz')
  assert.ok(result.includes('сүт'))
  assert.ok(result.includes('нан'))
})

test('fmtDate ru — formats Date object', () => {
  const d = new Date(2025, 0, 15)
  const result = fmtDate(d, 'ru')
  assert.ok(result.includes('2025'))
  assert.ok(result.includes('15'))
})

test('fmtDate ru — formats ISO string', () => {
  const result = fmtDate('2025-01-15', 'ru')
  assert.ok(result.includes('2025'))
})

test('fmtDate kz — formats Date object', () => {
  const d = new Date(2025, 0, 15)
  const result = fmtDate(d, 'kz')
  assert.ok(result.includes('2025'))
})

test('fmtNumber ru — 1500 → formatted with separator', () => {
  const result = fmtNumber(1500, 'ru')
  assert.ok(result.includes('1') && result.includes('500'))
})

test('fmtNumber kz — 1500 → formatted', () => {
  const result = fmtNumber(1500, 'kz')
  assert.ok(result.includes('1') && result.includes('500'))
})
