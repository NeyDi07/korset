export function fmtPrice(amount, lang) {
  return new Intl.NumberFormat(lang === 'kz' ? 'kk-KZ' : 'ru-RU', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function fmtList(items, lang) {
  if (!items || items.length === 0) return ''
  if (items.length === 1) return items[0]
  return new Intl.ListFormat(lang === 'kz' ? 'kk-KZ' : 'ru-RU', {
    style: 'long',
    type: 'conjunction',
  }).format(items)
}

export function fmtDate(date, lang) {
  return new Intl.DateTimeFormat(lang === 'kz' ? 'kk-KZ' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date instanceof Date ? date : new Date(date))
}

export function fmtNumber(n, lang) {
  return new Intl.NumberFormat(lang === 'kz' ? 'kk-KZ' : 'ru-RU').format(n)
}
