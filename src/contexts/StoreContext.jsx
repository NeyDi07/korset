import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../utils/supabase.js'
import { loadPrivacySettings, PRIVACY_EVENT } from '../utils/privacySettings.js'
import { getStoreBySlug } from '../data/stores.js'
import {
  buildAIHomePath,
  buildCatalogPath,
  buildHistoryPath,
  buildStoreHomePath,
  buildProductAIPath,
  buildProductAlternativesPath,
  buildProductPath,
  buildProfilePath,
  buildScanPath,
  buildStorePublicPath,
} from '../utils/routes.js'

const StoreContext = createContext(null)
export const STORE_KEY = 'korset_store_slug'
const STORE_CACHE_PREFIX = 'korset_store_data_'

function getStoreSlugFromPath(pathname) {
  const appMatch = pathname.match(/^\/s\/([^/]+)/)
  if (appMatch) return appMatch[1]
  const retailMatch = pathname.match(/^\/retail\/([^/]+)/)
  if (retailMatch) return retailMatch[1]
  const publicMatch = pathname.match(/^\/stores\/([^/]+)/)
  if (publicMatch) return publicMatch[1]
  return null
}

function loadStoreFromCache(slug) {
  if (!slug) return null
  try {
    const raw = localStorage.getItem(`${STORE_CACHE_PREFIX}${slug}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveStoreToCache(slug, store) {
  if (!slug || !store) return
  try {
    localStorage.setItem(`${STORE_CACHE_PREFIX}${slug}`, JSON.stringify(store))
  } catch {
    /* noop */
  }
}

function normalizeStore(data) {
  if (!data) return null
  return {
    ...data,
    slug: data.code,
    isActive: data.is_active,
  }
}

async function fetchStoreBySlug(slug) {
  if (!slug) return null
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('code', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (!error && data) return normalizeStore(data)
  const local = getStoreBySlug(slug)
  return local ? normalizeStore({ ...local, code: local.slug, is_active: local.isActive }) : null
}

export function StoreProvider({ children }) {
  const location = useLocation()
  const pathStoreSlug = getStoreSlugFromPath(location.pathname)
  const [rememberStoreEnabled, setRememberStoreEnabled] = useState(
    () => loadPrivacySettings().rememberStoreEnabled
  )
  const [rememberedStoreSlug, setRememberedStoreSlug] = useState(() =>
    loadPrivacySettings().rememberStoreEnabled ? localStorage.getItem(STORE_KEY) || null : null
  )

  const storeSlug = pathStoreSlug || (rememberStoreEnabled ? rememberedStoreSlug : null) || null

  const [currentStore, setCurrentStore] = useState(() => loadStoreFromCache(storeSlug))
  const [isStoreLoading, setIsStoreLoading] = useState(() =>
    Boolean(storeSlug && !loadStoreFromCache(storeSlug))
  )

  useEffect(() => {
    const syncPrivacy = () => {
      const nextEnabled = loadPrivacySettings().rememberStoreEnabled
      setRememberStoreEnabled(nextEnabled)
      if (!nextEnabled) {
        setRememberedStoreSlug(null)
        localStorage.removeItem(STORE_KEY)
      } else {
        setRememberedStoreSlug(localStorage.getItem(STORE_KEY) || null)
      }
    }
    window.addEventListener('storage', syncPrivacy)
    window.addEventListener(PRIVACY_EVENT, syncPrivacy)
    return () => {
      window.removeEventListener('storage', syncPrivacy)
      window.removeEventListener(PRIVACY_EVENT, syncPrivacy)
    }
  }, [])

  useEffect(() => {
    if (pathStoreSlug) {
      setRememberedStoreSlug(pathStoreSlug)
      if (rememberStoreEnabled) localStorage.setItem(STORE_KEY, pathStoreSlug)
    }
  }, [pathStoreSlug, rememberStoreEnabled])

  useEffect(() => {
    if (!storeSlug) {
      setCurrentStore(null)
      setIsStoreLoading(false)
      return
    }

    const cached = loadStoreFromCache(storeSlug)
    if (cached) {
      setCurrentStore(cached)
      setIsStoreLoading(false)
    } else {
      setIsStoreLoading(true)
    }

    fetchStoreBySlug(storeSlug).then((store) => {
      if (store) {
        setCurrentStore(store)
        saveStoreToCache(storeSlug, store)
      }
      setIsStoreLoading(false)
    })
  }, [storeSlug])

  const isStoreApp = /^\/s\/[^/]+/.test(location.pathname)
  const isStorePublic = /^\/stores\/[^/]+/.test(location.pathname)
  const isPublicMarketing =
    location.pathname === '/' || location.pathname === '/stores' || isStorePublic

  const value = useMemo(
    () => ({
      storeSlug: currentStore?.slug || null,
      storeId: currentStore?.id || null,
      currentStore,
      isStoreLoading,
      isStoreApp,
      isStorePublic,
      isPublicMarketing,
      rememberStore: (slug) => {
        setRememberedStoreSlug(slug)
        if (rememberStoreEnabled) localStorage.setItem(STORE_KEY, slug)
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
      routes: currentStore
        ? {
            home: buildStoreHomePath(currentStore.slug),
            catalog: buildCatalogPath(currentStore.slug),
            scan: buildScanPath(currentStore.slug),
            ai: buildAIHomePath(currentStore.slug),
            history: buildHistoryPath(currentStore.slug),
            profile: buildProfilePath(currentStore.slug),
            publicPage: buildStorePublicPath(currentStore.slug),
            product: (ean, external = false) => buildProductPath(currentStore.slug, ean, external),
            productAI: (ean, external = false) =>
              buildProductAIPath(currentStore.slug, ean, external),
            productAlternatives: (ean) => buildProductAlternativesPath(currentStore.slug, ean),
          }
        : null,
    }),
    [
      currentStore,
      isStoreLoading,
      isStoreApp,
      isStorePublic,
      isPublicMarketing,
      rememberStoreEnabled,
    ]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}

export function useStoreId() {
  return useStore()?.storeId || null
}
