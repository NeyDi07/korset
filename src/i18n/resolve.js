import { selectPluralSuffix } from './plural.js'
import { interpolate } from './interpolate.js'

export function resolve(lang, dict, key, vars, fallbackDict) {
  let val = dict[key]

  if (val == null || val === '') {
    val = fallbackDict?.[key]
    if (val != null) {
      if (import.meta.env?.DEV) {
        console.warn(`[i18n] missing "${key}" for lang="${lang}", using RU fallback`)
      }
    } else {
      if (import.meta.env?.DEV) {
        console.error(`[i18n] missing "${key}" in BOTH languages`)
      }
      return import.meta.env?.DEV ? `⚠${key}` : key
    }
  }

  if (vars?.count != null) {
    const suffix = selectPluralSuffix(lang, vars.count)
    const pluralKey = `${key}_${suffix}`
    const pluralVal = dict[pluralKey] ?? fallbackDict?.[pluralKey]
    if (pluralVal != null) val = pluralVal
  }

  if (vars && typeof val === 'string') {
    val = interpolate(val, vars)
  }

  return val
}
