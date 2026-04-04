import products from '../data/products.json'
import { STORE_PRODUCT_MAP } from '../data/stores.js'

function withStoreMeta(product, storeSlug = null) {
  if (!product) return null
  return {
    ...product,
    storeSlug: storeSlug || null,
    canonicalId: product.ean || product.id,
  }
}

export function getGlobalDemoProducts() {
  return products.map((product) => withStoreMeta(product))
}

export function getStoreCatalogProducts(storeSlug) {
  if (!storeSlug || !STORE_PRODUCT_MAP[storeSlug]) return []
  const allowedEans = new Set(STORE_PRODUCT_MAP[storeSlug])
  return products
    .filter((product) => allowedEans.has(product.ean))
    .map((product) => withStoreMeta(product, storeSlug))
}

export function getAnyKnownProductByRef(ref, storeSlug = null) {
  return (
    getStoreCatalogProducts(storeSlug).find((product) => product.ean === ref || product.id === ref) ||
    getGlobalDemoProducts().find((product) => product.ean === ref || product.id === ref) ||
    null
  )
}

export function getProductByEan(ean, storeSlug = null) {
  return getAnyKnownProductByRef(ean, storeSlug)
}

export function getStoreCatalogProductByEan(storeSlug, ean) {
  return getStoreCatalogProducts(storeSlug).find((product) => product.ean === ean) || null
}

export function isStoreCatalogProduct(storeSlug, ean) {
  return Boolean(getStoreCatalogProductByEan(storeSlug, ean))
}
