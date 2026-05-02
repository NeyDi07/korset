export function formatPrice(kzt) {
  if (kzt == null) return '—'
  if (kzt === 0) return '0 ₸'
  return kzt.toLocaleString('ru-RU') + ' ₸'
}
