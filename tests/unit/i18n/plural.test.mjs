import test from 'node:test'
import assert from 'node:assert/strict'

import { selectPluralSuffix } from '../../../src/i18n/plural.js'

test('ru: 1 → one', () => {
  assert.equal(selectPluralSuffix('ru', 1), 'one')
})

test('ru: 2 → few', () => {
  assert.equal(selectPluralSuffix('ru', 2), 'few')
})

test('ru: 3 → few', () => {
  assert.equal(selectPluralSuffix('ru', 3), 'few')
})

test('ru: 4 → few', () => {
  assert.equal(selectPluralSuffix('ru', 4), 'few')
})

test('ru: 5 → many', () => {
  assert.equal(selectPluralSuffix('ru', 5), 'many')
})

test('ru: 11 → many', () => {
  assert.equal(selectPluralSuffix('ru', 11), 'many')
})

test('ru: 12 → many', () => {
  assert.equal(selectPluralSuffix('ru', 12), 'many')
})

test('ru: 21 → one', () => {
  assert.equal(selectPluralSuffix('ru', 21), 'one')
})

test('ru: 22 → few', () => {
  assert.equal(selectPluralSuffix('ru', 22), 'few')
})

test('ru: 25 → many', () => {
  assert.equal(selectPluralSuffix('ru', 25), 'many')
})

test('ru: 0 → many', () => {
  assert.equal(selectPluralSuffix('ru', 0), 'many')
})

test('ru: 101 → one', () => {
  assert.equal(selectPluralSuffix('ru', 101), 'one')
})

test('kz: 1 → one (kk locale)', () => {
  assert.equal(selectPluralSuffix('kz', 1), 'one')
})

test('kz: 2 → other (kk locale has only one/other)', () => {
  assert.equal(selectPluralSuffix('kz', 2), 'other')
})

test('kz: 5 → other', () => {
  assert.equal(selectPluralSuffix('kz', 5), 'other')
})

test('kz: 11 → other', () => {
  assert.equal(selectPluralSuffix('kz', 11), 'other')
})

test('kz: 21 → other', () => {
  assert.equal(selectPluralSuffix('kz', 21), 'other')
})

test('kz: 0 → other', () => {
  assert.equal(selectPluralSuffix('kz', 0), 'other')
})

test('unknown lang falls back to ru plural rules', () => {
  assert.equal(selectPluralSuffix('en', 1), 'one')
})

test('kz alias uses kk Intl.PluralRules', () => {
  const kzResult = selectPluralSuffix('kz', 1)
  const kkLikeResult = new Intl.PluralRules('kk').select(1)
  assert.equal(kzResult, kkLikeResult)
})
