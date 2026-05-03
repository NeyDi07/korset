import test from 'node:test'
import assert from 'node:assert/strict'

import { interpolate } from '../../../src/i18n/interpolate.js'

test('replaces single {name} variable', () => {
  assert.equal(interpolate('Hello, {name}!', { name: 'Körset' }), 'Hello, Körset!')
})

test('replaces multiple variables', () => {
  assert.equal(
    interpolate('{greeting}, {name}!', { greeting: 'Сәлем', name: 'Айдана' }),
    'Сәлем, Айдана!'
  )
})

test('leaves unreferenced vars intact as {key}', () => {
  assert.equal(interpolate('Hello, {name}!', {}), 'Hello, {name}!')
})

test('returns template unchanged when vars is null', () => {
  assert.equal(interpolate('Hello, {name}!', null), 'Hello, {name}!')
})

test('returns template unchanged when vars is undefined', () => {
  assert.equal(interpolate('Hello, {name}!', undefined), 'Hello, {name}!')
})

test('returns non-string template unchanged', () => {
  assert.equal(interpolate(42, { name: 'test' }), 42)
})

test('handles numeric var values by casting to string', () => {
  assert.equal(interpolate('{count} items', { count: 5 }), '5 items')
})

test('handles var value of 0', () => {
  assert.equal(interpolate('{count} items', { count: 0 }), '0 items')
})

test('does not replace dots inside braces — {a.b} stays', () => {
  assert.equal(interpolate('{a.b}', { a: 'x' }), '{a.b}')
})

test('empty string var replaces the placeholder', () => {
  assert.equal(interpolate('{name}', { name: '' }), '')
})

test('null var value leaves placeholder intact', () => {
  assert.equal(interpolate('{name}', { name: null }), '{name}')
})

test('no placeholders — returns template as-is', () => {
  assert.equal(interpolate('No vars here', { name: 'test' }), 'No vars here')
})

test('empty template string', () => {
  assert.equal(interpolate('', { name: 'test' }), '')
})
