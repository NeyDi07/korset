import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getStoreBySlug } from '../data/stores.js'
import {
  buildAIHomePath,
  buildCatalogPath,
  buildHistoryPath,
  buildProductAIPath,
  buildProductAlternativesPath,
  buildProductPath,
  buildProfilePath,
  buildScanPath,
  buildStorePublicPath,
} from '../utils/routes.js'

const StoreContext = createContext(null)
const STORE_KEY = 'korset_store_slug'

function getStoreSlugFromPath(pathname) {
  const appMatch = pathname.match(/^\/s\/([^/]+)/)
  if (appMatch) return appMatch[1]
  const publicMatch = pathname.match(/^\/stores\/([^/]+)/)
  if (publicMatch) return publicMatch[1]
  return null
}

export function StoreProvider({ children }) {
  const location = useLocation()
  const pathStoreSlug = getStoreSlugFromPath(location.pathname)
  const [rememberedStoreSlug, setRememberedStoreSlug] = useState(() => localStorage.getItem(STORE_KEY) || null)

  useEffect(() => {
    if (pathStoreSlug) {
      setRememberedStoreSlug(pathStoreSlug)
      localStorage.setItem(STORE_KEY, pathStoreSlug)
    }
  }, [pathStoreSlug])

  const storeSlug = pathStoreSlug || rememberedStoreSlug || null
  const currentStore = getStoreBySlug(storeSlug)
  const isStoreApp = /^\/s\/[^/]+/.test(location.pathname)
  const isStorePublic = /^\/stores\/[^/]+/.test(location.pathname)
  const isPublicMarketing = location.pathname === '/' || location.pathname === '/stores' || isStorePublic

  const value = useMemo(() => ({
    storeSlug: currentStore?.slug || null,
    storeId: currentStore?.id || null,
    currentStore,
    isStoreApp,
    isStorePublic,
    isPublicMarketing,
    rememberStore: (slug) => {
      setRememberedStoreSlug(slug)
      localStorage.setItem(STORE_KEY, slug)
    },
    clearRememberedStore: () => {
      setRememberedStoreSlug(null)
      localStorage.removeItem(STORE_KEY)
    },
    appPath: (subPath = '') => {
      if (!currentStore) return subPath || '/'
      if (!subPath || subPath === '/') return `/s/${currentStore.slug}`
      return `/s/${currentStore.slug}${subPath.startsWith('/') ? subPath : `/${subPath}`}`
    },
    routes: currentStore ? {
      home: `/s/${currentStore.slug}`,
      catalog: buildCatalogPath(currentStore.slug),
      scan: buildScanPath(currentStore.slug),
      ai: buildAIHomePath(currentStore.slug),
      history: buildHistoryPath(currentStore.slug),
      profile: buildProfilePath(currentStore.slug),
      publicPage: buildStorePublicPath(currentStore.slug),
      product: (ean, external = false) => buildProductPath(currentStore.slug, ean, external),
      productAI: (ean, external = false) => buildProductAIPath(currentStore.slug, ean, external),
      productAlternatives: (ean) => buildProductAlternativesPath(currentStore.slug, ean),
    } : null,
  }), [currentStore, isStoreApp, isStorePublic, isPublicMarketing])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}

export function useStoreId() {
  return useStore()?.storeId || null
}
