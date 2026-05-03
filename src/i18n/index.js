import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadDict } from './loader.js'
import { resolve } from './resolve.js'
import { fmtPrice, fmtList, fmtDate, fmtNumber } from './format.js'

const LANG_KEY = 'korset_lang'

export function getLang() {
  return localStorage.getItem(LANG_KEY) || 'ru'
}

export function setLang(lang) {
  localStorage.setItem(LANG_KEY, lang)
  document.documentElement.lang = lang === 'kz' ? 'kk' : 'ru'
  document.documentElement.dir = 'ltr'
  window.dispatchEvent(new CustomEvent('korset:lang', { detail: lang }))
}

export function useLang() {
  const [lang, setLangState] = useState(getLang())

  useEffect(() => {
    const onChange = () => {
      const next = getLang()
      setLangState(next)
    }
    window.addEventListener('korset:lang', onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('korset:lang', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === 'kz' ? 'kk' : 'ru'
    document.documentElement.dir = 'ltr'
  }, [lang])

  return lang
}

export function useI18n() {
  const lang = useLang()

  const dict = useMemo(() => loadDict(lang), [lang])
  const fallbackDict = useMemo(() => (lang === 'ru' ? null : loadDict('ru')), [lang])

  const t = useCallback(
    (key, vars) => resolve(lang, dict, key, vars, fallbackDict),
    [lang, dict, fallbackDict]
  )

  const exists = useCallback(
    (key) =>
      (dict[key] != null && dict[key] !== '') ||
      (fallbackDict?.[key] != null && fallbackDict[key] !== ''),
    [dict, fallbackDict]
  )

  const format = useMemo(
    () => ({
      price: (n) => fmtPrice(n, lang),
      list: (arr) => fmtList(arr, lang),
      date: (d) => fmtDate(d, lang),
      number: (n) => fmtNumber(n, lang),
    }),
    [lang]
  )

  return { t, exists, lang, format }
}

export { selectPluralSuffix } from './plural.js'
export { interpolate } from './interpolate.js'
