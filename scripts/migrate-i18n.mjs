import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(__dirname, '../src')
const localesDir = resolve(__dirname, '../src/locales')

const DRY_RUN = !process.argv.includes('--live')

const ALL_KEYS = new Set()
for (const lang of ['ru', 'kz']) {
  const dir = resolve(localesDir, lang)
  try {
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith('.json')) continue
      const data = JSON.parse(readFileSync(resolve(dir, entry), 'utf-8'))
      for (const key of Object.keys(data)) ALL_KEYS.add(key)
    }
  } catch {}
}

const I18N_NAMESPACES = new Set([
  'nav', 'common', 'home', 'scan', 'product', 'catalog', 'alternatives',
  'ai', 'onboarding', 'profile', 'account', 'qr', 'landing', 'footer',
  'compare', 'retail', 'notification', 'privacy',
  'langShort', 'langRu', 'langKz',
])

const SKIP_PROPS = new Set([
  'stop', 'querySelector', 'querySelectorAll', 'getBoundingClientRect',
  'setAttribute', 'getAttribute', 'classList', 'style', 'innerHTML',
  'textContent', 'appendChild', 'removeChild', 'addEventListener',
  'removeEventListener', 'dispatchEvent', 'focus', 'blur', 'click',
  'scrollIntoView', 'scrollTo', 'getElementsByClassName',
  'setQueryData', 'invalidateQueries', 'getQueryData', 'setQueriesData',
  'cancelQueries', 'resetQueries', 'fetchQuery', 'prefetchQuery',
  'target', 'value', 'id', 'ean', 'brand', 'category',
  'trim', 'entries', 'keys', 'values', 'toString', 'valueOf',
  'indexOf', 'includes', 'startsWith', 'endsWith', 'replace',
  'split', 'join', 'slice', 'splice', 'map', 'filter', 'reduce',
  'forEach', 'find', 'findIndex', 'some', 'every', 'length',
  'push', 'pop', 'shift', 'unshift', 'concat', 'flat', 'sort',
  'reverse', 'from', 'isArray', 'assign', 'freeze', 'defineProperty',
  'current', 'currentTarget', 'preventDefault', 'stopPropagation',
  'persist', 'nativeEvent', 'type', 'code', 'key', 'keyCode',
  'checked', 'selected', 'disabled', 'hidden', 'files',
  'offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight',
  'scrollTop', 'scrollLeft', 'offsetTop', 'offsetLeft',
  'parentNode', 'parentElement', 'nextSibling', 'previousSibling',
  'firstChild', 'lastChild', 'children', 'childNodes',
  'play', 'pause', 'load', 'addTextTrack',
  'bg', 'border', 'text', 'gap', 'px', 'padding', 'margin',
  'color', 'background', 'fontWeight', 'fontSize', 'lineHeight',
  'display', 'flexDirection', 'alignItems', 'justifyContent',
  'position', 'top', 'bottom', 'left', 'right', 'width', 'height',
  'zIndex', 'opacity', 'transform', 'transition', 'animation',
])

const ARRAY_METHODS = new Set([
  'map', 'filter', 'forEach', 'reduce', 'find', 'findIndex',
  'some', 'every', 'join', 'flat', 'flatMap', 'concat', 'slice',
  'splice', 'sort', 'reverse', 'pop', 'shift', 'unshift', 'push',
])

function walkDir(dir) {
  const files = []
  try {
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry)
      if (statSync(full).isDirectory()) {
        files.push(...walkDir(full))
      } else if (entry.endsWith('.jsx') || entry.endsWith('.js')) {
        files.push(full)
      }
    }
  } catch {}
  return files
}

function extractDotChain(code, startPos) {
  let pos = startPos
  const parts = []
  let optionalCount = 0
  while (pos < code.length) {
    const ch = code[pos]
    if (ch === '?') {
      if (code[pos + 1] === '.') {
        optionalCount++
        pos += 2
        continue
      }
      break
    }
    if (ch === '.') {
      pos++
      continue
    }
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = ''
      while (pos < code.length && /[a-zA-Z0-9_$]/.test(code[pos])) {
        ident += code[pos]
        pos++
      }
      parts.push(ident)
    } else {
      break
    }
  }
  return { parts, endPos: pos, optionalCount }
}

function migrateFile(filePath) {
  const src = readFileSync(filePath, 'utf-8')
  const relPath = relative(srcDir, filePath)

  if (!src.includes('i18n')) return null

  const usesOldI18n = /from\s+['"][^'"]*\/utils\/i18n\.js['"]/.test(src)
  if (!usesOldI18n) return null

  const changes = []
  const flags = []
  let result = src

  result = result.replace(
    /\bt\.langShort\s*===\s*['"]Қаз['"]/g,
    (match) => {
      changes.push(`LANGCHECK: ${match} → lang === 'kz'`)
      return "lang === 'kz'"
    },
  )

  result = result.replace(
    /from\s+['"][^'"]*\/utils\/i18n\.js['"]/g,
    (match) => {
      const newImport = match.replace('/utils/i18n.js', '/i18n/index.js')
      changes.push(`import: ${match} → ${newImport}`)
      return newImport
    },
  )

  const i18nVarMatch = result.match(/\bconst\s*\{\s*([^}]*?)\s*\}\s*=\s*useI18n\(\)/)
  const i18nVarName = i18nVarMatch
    ? (i18nVarMatch[1].split(',').map(s => s.trim()).find(s => /^t$/.test(s)) ? 't' : null)
    : null

  const patterns = []
  const varName = i18nVarName || 't'

  let searchPos = 0
  while (searchPos < result.length) {
    const idx = result.indexOf(`${varName}.`, searchPos)
    if (idx === -1) break

    const beforeChar = idx > 0 ? result[idx - 1] : ' '
    if (/[a-zA-Z0-9_$]/.test(beforeChar)) {
      searchPos = idx + 1
      continue
    }

    const chain = extractDotChain(result, idx + varName.length + 1)

    if (chain.parts.length === 0) {
      searchPos = idx + 1
      continue
    }

    const firstProp = chain.parts[0]

    if (SKIP_PROPS.has(firstProp)) {
      searchPos = idx + 1
      continue
    }

    if (!I18N_NAMESPACES.has(firstProp)) {
      searchPos = idx + 1
      continue
    }

    const fullKey = chain.parts.join('.')
    const afterChain = result.slice(chain.endPos)

    if (ARRAY_METHODS.has(chain.parts[chain.parts.length - 1])) {
      const arrayKey = chain.parts.slice(0, -1).join('.')
      flags.push(`ARRAY_METHOD: ${varName}.${fullKey}(...) — key="${arrayKey}", needs manual array→t() conversion`)
      searchPos = chain.endPos
      continue
    }

    if (!ALL_KEYS.has(fullKey)) {
      const afterTest = afterChain.slice(0, 5)
      const isObjAccess = afterTest.startsWith('.') || afterTest.startsWith('?')

      if (isObjAccess) {
        searchPos = chain.endPos
        continue
      }

      flags.push(`NAMESPACE_ONLY: ${varName}.${fullKey} — no flat key, needs manual review`)
      searchPos = chain.endPos
      continue
    }

    const funcCallMatch = afterChain.match(/^\s*\(([^)]*)\)/)
    if (funcCallMatch) {
      const arg = funcCallMatch[1].trim()
      if (!arg) {
        searchPos = chain.endPos
        continue
      }
      const callEnd = chain.endPos + funcCallMatch[0].length
      const originalText = result.slice(idx, callEnd)
      let varKey
      if (fullKey.includes('countLabel') || fullKey.includes('allLoaded') || fullKey.includes('localHistoryDesc')) {
        varKey = 'count'
      } else if (fullKey.includes('chipQuestions')) {
        varKey = 'name'
      } else {
        varKey = arg.replace(/\s/g, '') || 'n'
      }
      const replacement = `t('${fullKey}', { ${varKey}: ${arg} })`
      changes.push(`FUNC: ${originalText} → ${replacement}`)
      patterns.push({ start: idx, end: callEnd, replacement })
      searchPos = callEnd
      continue
    }

    const fallbackMatch = afterChain.match(/^\s*\|\|\s*['"`]([^'"`]*?)['"`]/)
    if (fallbackMatch) {
      const fbEnd = chain.endPos + fallbackMatch[0].length
      const originalText = result.slice(idx, fbEnd)
      const replacement = `t('${fullKey}')`
      changes.push(`FALLBACK: ${originalText} → ${replacement}`)
      patterns.push({ start: idx, end: fbEnd, replacement })
      searchPos = fbEnd
      continue
    }

    const originalText = result.slice(idx, chain.endPos)
    const replacement = `t('${fullKey}')`
    changes.push(`DOT: ${originalText} → ${replacement}`)
    patterns.push({ start: idx, end: chain.endPos, replacement })
    searchPos = chain.endPos
  }

  for (let i = patterns.length - 1; i >= 0; i--) {
    const p = patterns[i]
    result = result.slice(0, p.start) + p.replacement + result.slice(p.end)
  }

  if (result !== src) {
    if (!DRY_RUN) {
      writeFileSync(filePath, result, 'utf-8')
    }
  }

  if (changes.length === 0 && flags.length === 0) return null

  return { relPath, changes, flags }
}

console.log(`\ni18n Migration Script — ${DRY_RUN ? 'DRY RUN' : 'LIVE MODE'}`)
console.log(`Dictionary: ${ALL_KEYS.size} flat keys loaded`)
console.log('='.repeat(60))

const files = walkDir(resolve(srcDir, 'screens'))
  .concat(walkDir(resolve(srcDir, 'components')))
  .concat(walkDir(resolve(srcDir, 'layouts')))

let totalChanges = 0
let totalFlags = 0
const results = []

for (const file of files) {
  const r = migrateFile(file)
  if (!r) continue
  results.push(r)
  totalChanges += r.changes.length
  totalFlags += r.flags.length
}

results.sort((a, b) => a.relPath.localeCompare(b.relPath))

for (const r of results) {
  console.log(`\n${r.relPath}`)
  for (const c of r.changes) console.log(`  + ${c}`)
  for (const f of r.flags) console.log(`  ! ${f}`)
}

console.log('\n' + '='.repeat(60))
console.log(`Files: ${results.length} | Auto-changes: ${totalChanges} | Flags: ${totalFlags}`)
if (DRY_RUN) console.log('Run with --live to apply changes.')
