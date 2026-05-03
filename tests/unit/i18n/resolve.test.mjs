import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

if (!import.meta.env) import.meta.env = {}
import.meta.env.DEV = true

import { resolve } from '../../../src/i18n/resolve.js'

function loadJson(lang, ns) {
  const p = join(import.meta.dirname, '..', '..', '..', 'src', 'locales', lang, `${ns}.json`)
  return JSON.parse(readFileSync(p, 'utf-8'))
}

const ruDict = { ...loadJson('ru', 'common'), ...loadJson('ru', 'product') }
const kzDict = { ...loadJson('kz', 'common'), ...loadJson('kz', 'product') }

test('resolve finds key in primary dict', () => {
  assert.equal(resolve('ru', ruDict, 'common.loading', undefined, null), 'Загрузка...')
})

test('resolve falls back to fallbackDict when KZ key missing', () => {
  const kzMissing = { ...kzDict }
  delete kzMissing['common.loading']
  const result = resolve('kz', kzMissing, 'common.loading', undefined, ruDict)
  assert.equal(result, 'Загрузка...')
})

test('resolve returns key path when missing in both dicts', () => {
  assert.equal(resolve('ru', ruDict, 'nonexistent.key', undefined, null), 'nonexistent.key')
})

test('resolve returns key path when missing in both dicts with fallback', () => {
  assert.equal(resolve('kz', kzDict, 'nonexistent.key', undefined, ruDict), 'nonexistent.key')
})

test('resolve with empty string in primary dict falls back', () => {
  const dict = { 'test.key': '' }
  const fallback = { 'test.key': 'fallback value' }
  const result = resolve('kz', dict, 'test.key', undefined, fallback)
  assert.equal(result, 'fallback value')
})

test('resolve interpolates vars', () => {
  const dict = { 'greeting': 'Hello, {name}!' }
  const result = resolve('ru', dict, 'greeting', { name: 'Körset' }, null)
  assert.equal(result, 'Hello, Körset!')
})

test('resolve with count selects plural suffix from primary dict', () => {
  const dict = {
    'items': '{count} товар',
    'items_one': '{count} товар',
    'items_few': '{count} товара',
    'items_many': '{count} товаров',
  }
  const result1 = resolve('ru', dict, 'items', { count: 1 }, null)
  assert.equal(result1, '1 товар')

  const result2 = resolve('ru', dict, 'items', { count: 2 }, null)
  assert.equal(result2, '2 товара')

  const result5 = resolve('ru', dict, 'items', { count: 5 }, null)
  assert.equal(result5, '5 товаров')
})

test('resolve with count falls back to fallbackDict for plural key', () => {
  const dict = {
    'items': '{count} тауар',
  }
  const fallback = {
    'items': '{count} товар',
    'items_one': '{count} товар',
    'items_few': '{count} товара',
    'items_many': '{count} товаров',
  }
  const result = resolve('kz', dict, 'items', { count: 5 }, fallback)
  assert.ok(result.includes('5'))
})

test('resolve without count does not look for plural keys', () => {
  const dict = {
    'items': 'товары',
    'items_one': 'товар',
  }
  const result = resolve('ru', dict, 'items', undefined, null)
  assert.equal(result, 'товары')
})

test('resolve with count=0 uses many suffix for ru', () => {
  const dict = {
    'items': '{count} товар',
    'items_many': '{count} товаров',
  }
  const result = resolve('ru', dict, 'items', { count: 0 }, null)
  assert.equal(result, '0 товаров')
})

test('resolve real key from product namespace', () => {
  assert.ok(typeof resolve('ru', ruDict, 'product.fits', undefined, null) === 'string')
})

test('resolve kz key returns kazakh value', () => {
  const result = resolve('kz', kzDict, 'common.loading', undefined, ruDict)
  assert.equal(result, 'Жүктелуде...')
})

test('resolve with null fallbackDict', () => {
  const result = resolve('ru', ruDict, 'common.back', undefined, null)
  assert.equal(result, 'Назад')
})

test('resolve with undefined fallbackDict', () => {
  const result = resolve('ru', ruDict, 'common.back', undefined, undefined)
  assert.equal(result, 'Назад')
})

test('resolve kz plural uses kk rules (one/other)', () => {
  const dict = {
    'items': '{count} тауар',
    'items_one': '{count} тауар',
    'items_other': '{count} тауар',
  }
  const result1 = resolve('kz', dict, 'items', { count: 1 }, null)
  assert.equal(result1, '1 тауар')

  const result5 = resolve('kz', dict, 'items', { count: 5 }, null)
  assert.equal(result5, '5 тауар')
})
