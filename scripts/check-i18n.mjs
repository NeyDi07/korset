import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES_DIR = join(import.meta.dirname, '..', 'src', 'locales')
const NAMESPACES = [
  'common', 'home', 'scan', 'product', 'compare', 'alternatives',
  'ai', 'onboarding', 'settings', 'retail', 'qr', 'auth', 'profile', 'history',
]

function loadNamespace(lang, ns) {
  const filePath = join(LOCALES_DIR, lang, `${ns}.json`)
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function collectKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

let hasKzMissing = false
const summary = { namespaces: 0, missingKz: 0, orphanKz: 0, empty: 0, identical: 0 }

for (const ns of NAMESPACES) {
  const ru = loadNamespace('ru', ns)
  const kz = loadNamespace('kz', ns)

  if (!ru) {
    console.log(`⚠  RU ${ns}.json not found — skipping`)
    continue
  }
  if (!kz) {
    console.log(`❌ KZ ${ns}.json not found`)
    hasKzMissing = true
    summary.missingKz += Object.keys(ru).length
    summary.namespaces++
    continue
  }

  const ruKeys = new Set(Object.keys(ru))
  const kzKeys = new Set(Object.keys(kz))

  const missingInKz = [...ruKeys].filter(k => !kzKeys.has(k))
  const orphanInKz = [...kzKeys].filter(k => !ruKeys.has(k))
  const emptyRu = [...ruKeys].filter(k => ru[k] === '')
  const emptyKz = [...kzKeys].filter(k => kz[k] === '')
  const identical = [...ruKeys].filter(k => kzKeys.has(k) && ru[k] === kz[k])

  const hasIssues = missingInKz.length || orphanInKz.length || emptyRu.length || emptyKz.length || identical.length

  if (!hasIssues) {
    console.log(`✅ ${ns} — OK (${ruKeys.size} keys)`)
    summary.namespaces++
    continue
  }

  console.log(`\n📋 ${ns} (${ruKeys.size} RU keys, ${kzKeys.size} KZ keys)`)

  if (missingInKz.length) {
    hasKzMissing = true
    summary.missingKz += missingInKz.length
    console.log(`  ❌ Missing in KZ (${missingInKz.length}):`)
    missingInKz.forEach(k => console.log(`     - ${k}`))
  }

  if (orphanInKz.length) {
    summary.orphanKz += orphanInKz.length
    console.log(`  ⚠  Orphan in KZ (${orphanInKz.length}):`)
    orphanInKz.forEach(k => console.log(`     - ${k}`))
  }

  if (emptyRu.length) {
    summary.empty += emptyRu.length
    console.log(`  ⚠  Empty in RU (${emptyRu.length}):`)
    emptyRu.forEach(k => console.log(`     - ${k}`))
  }

  if (emptyKz.length) {
    summary.empty += emptyKz.length
    console.log(`  ⚠  Empty in KZ (${emptyKz.length}):`)
    emptyKz.forEach(k => console.log(`     - ${k}`))
  }

  if (identical.length) {
    summary.identical += identical.length
    console.log(`  🔍 Identical RU=KZ (${identical.length}) — possibly untranslated:`)
    identical.forEach(k => console.log(`     - ${k}: "${ru[k]}"`))
  }

  summary.namespaces++
}

console.log('\n' + '─'.repeat(50))
console.log(`SUMMARY: ${summary.namespaces} namespaces checked`)
console.log(`  Missing in KZ:    ${summary.missingKz}`)
console.log(`  Orphan in KZ:     ${summary.orphanKz}`)
console.log(`  Empty values:     ${summary.empty}`)
console.log(`  Identical RU=KZ:  ${summary.identical}`)

if (hasKzMissing) {
  console.log('\n❌ FAIL: some KZ keys are missing')
  process.exit(1)
} else {
  console.log('\n✅ PASS: all KZ keys present')
  process.exit(0)
}
