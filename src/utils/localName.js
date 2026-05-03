import { useLang, getLang } from '../i18n/index.js'

export function getLocalName(product) {
  if (!product) return ''
  const lang = getLang()
  return lang === 'kz' && product.nameKz ? product.nameKz : product.name
}

export function useLocalName(product) {
  const lang = useLang()
  if (!product) return ''
  return lang === 'kz' && product.nameKz ? product.nameKz : product.name
}
