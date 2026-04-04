export const STORES = [
  {
    id: 'store-one',
    slug: 'store-one',
    name: 'Магазин 1',
    city: 'Усть-Каменогорск',
    address: 'Тестовый магазин Körset',
    logo: '/logo.png',
    description: 'Тестовый магазин Körset с реальными продуктовыми SKU для демонстрации и дальнейшей обкатки магазинного сценария.',
    isActive: true,
    defaultLanguage: 'ru',
  },
]

export const STORE_ONE_EANS = [
  '4600000102452',
  '4600000102453',
  '4600000103012',
  '5000112546324',
  '5000112546325',
  '5000112546326',
  '4890008100309',
  '4870200003011',
  '4870200003012',
  '4870200003013',
  '4870200003014',
  '4870200003015',
  '4870200003020',
  '4870200003021',
  '4870200003022',
  '4870200003023',
]

export const STORE_PRODUCT_MAP = {
  'store-one': STORE_ONE_EANS,
}

export const ALLOW_GLOBAL_SCAN_FOR_NOW = true

export function getStoreBySlug(slug) {
  if (!slug) return null
  return STORES.find((store) => store.slug === slug) || null
}

export function getStores() {
  return STORES.filter((store) => store.isActive)
}
