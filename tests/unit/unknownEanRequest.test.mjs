import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canRequestUnknownProduct,
  getUnknownProductRequestCopy,
  requestUnknownProductCheck,
} from '../../src/domain/product/unknownEanRequest.js'

test('canRequestUnknownProduct accepts only supported barcode lengths with a store id', () => {
  assert.equal(canRequestUnknownProduct({ ean: '48701234', storeId: 'store-1' }), true)
  assert.equal(canRequestUnknownProduct({ ean: '4870123456789', storeId: 'store-1' }), true)
  assert.equal(canRequestUnknownProduct({ ean: '487012345678', storeId: 'store-1' }), false)
  assert.equal(canRequestUnknownProduct({ ean: '4870-1234', storeId: 'store-1' }), false)
  assert.equal(canRequestUnknownProduct({ ean: '48701234', storeId: null }), false)
})

test('requestUnknownProductCheck increments missing scan count through RPC', async () => {
  const calls = []
  const client = {
    rpc: async (name, params) => {
      calls.push({ name, params })
      return { error: null }
    },
  }

  const result = await requestUnknownProductCheck({
    ean: '4870123456789',
    storeId: 'store-1',
    client,
  })

  assert.deepEqual(result, { ok: true })
  assert.deepEqual(calls, [
    {
      name: 'increment_missing_scan_count',
      params: { p_ean: '4870123456789', p_store_id: 'store-1' },
    },
  ])
})

test('requestUnknownProductCheck returns a stable error for invalid requests', async () => {
  const result = await requestUnknownProductCheck({
    ean: '123',
    storeId: 'store-1',
    client: { rpc: async () => ({ error: null }) },
  })

  assert.deepEqual(result, { ok: false, reason: 'invalid_request' })
})

test('getUnknownProductRequestCopy keeps V1 wording focused on not found and unsupported goods', () => {
  const copy = getUnknownProductRequestCopy('ru')

  assert.match(copy.title, /не найден/i)
  assert.match(copy.body, /алкоголь/i)
  assert.match(copy.body, /табач/i)
  assert.match(copy.requestButton, /запрос/i)
})
