// Store ID management — привязка приложения к магазину через QR-код
// URL формат: https://korset.kz/?store=al-baraka-usk

const STORE_KEY = 'korset_store_id'

/**
 * Читает storeId из URL параметров и сохраняет в localStorage.
 * Вызывается один раз при старте приложения в App.jsx.
 */
export function initStoreFromURL() {
  try {
    const params = new URLSearchParams(window.location.search)
    const storeParam = params.get('store')
    if (storeParam) {
      localStorage.setItem(STORE_KEY, storeParam)
      // Убираем ?store= из URL (чтобы не светился при шаринге)
      const url = new URL(window.location)
      url.searchParams.delete('store')
      window.history.replaceState({}, '', url.pathname + url.search)
    }
  } catch (e) {
    console.warn('Körset: не удалось прочитать store из URL', e)
  }
}

/**
 * Возвращает текущий storeId (или null если не привязан к магазину)
 */
export function getStoreId() {
  try {
    return localStorage.getItem(STORE_KEY) || null
  } catch {
    return null
  }
}

/**
 * Возвращает название магазина для отображения
 */
export function getStoreName() {
  const id = getStoreId()
  if (!id) return null
  // Преобразуем slug в читаемое имя: al-baraka-usk → Al Baraka Usk
  return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
