import { supabase } from './supabase.js'

function makeRandomId(prefix) {
  // Prefer cryptographically strong UUID. Fallback only when crypto API unavailable.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

// Singleton fallback when storage is unavailable (e.g. Safari Private + iframe).
// Without this, every call would generate a NEW id → anti-spam broken, history lost.
const inMemoryIds = new Map()

function getOrCreateLocalId(storage, key, prefix) {
  try {
    let value = storage.getItem(key)
    if (!value) {
      value = makeRandomId(prefix)
      storage.setItem(key, value)
    }
    return value
  } catch {
    if (!inMemoryIds.has(key)) {
      inMemoryIds.set(key, makeRandomId(prefix))
    }
    return inMemoryIds.get(key)
  }
}

export function getOrCreateDeviceId() {
  return getOrCreateLocalId(localStorage, 'korset_device_id', 'dev')
}

export function getOrCreateSessionId() {
  return getOrCreateLocalId(sessionStorage, 'korset_session_id', 'ses')
}

// client_token — UUID v4, стабильный для устройства. Используется RLS-policy
// scan_events_insert_anon_safe (миграция 017) для anti-spam анонимных инсертов.
// Формат — чистый UUID (без префикса), потому что колонка scan_events.client_token — uuid type.
export function getOrCreateClientToken() {
  const KEY = 'korset_client_token'
  try {
    let value = localStorage.getItem(KEY)
    if (!value) {
      value =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : null
      if (!value) return null // Нет crypto → anti-spam не работает, лучше отправить null и получить RLS-deny.
      localStorage.setItem(KEY, value)
    }
    return value
  } catch {
    if (!inMemoryIds.has(KEY)) {
      const fallback =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : null
      if (!fallback) return null
      inMemoryIds.set(KEY, fallback)
    }
    return inMemoryIds.get(KEY)
  }
}

export async function resolveCurrentAuthUser() {
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user || null
  } catch {
    return null
  }
}

export async function resolveInternalUserIdForAuthUser(authUser, { ensureRow = false } = {}) {
  if (!authUser?.id) return null

  try {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .maybeSingle()

    if (data?.id) return data.id
    if (!ensureRow) return null

    const deviceId = getOrCreateDeviceId()
    const fallbackName =
      authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email || 'User'

    const { data: inserted, error } = await supabase
      .from('users')
      .upsert(
        {
          auth_id: authUser.id,
          device_id: deviceId,
          name: fallbackName,
        },
        { onConflict: 'auth_id' }
      )
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Failed to create users row:', error.message, error.details || error.hint)
      return null
    }

    return inserted?.id || null
  } catch (error) {
    console.error('Failed to resolve internal user id', error)
    return null
  }
}

export async function resolveCurrentInternalUserId(options = {}) {
  const authUser = await resolveCurrentAuthUser()
  return resolveInternalUserIdForAuthUser(authUser, options)
}

export function getProfileNameCacheKey(authId) {
  return authId ? `korset_profile_name_${authId}` : null
}

export function getProfileAvatarCacheKey(authId) {
  return authId ? `korset_profile_avatar_${authId}` : null
}

export function readCachedProfileName(authId) {
  try {
    const key = getProfileNameCacheKey(authId)
    return key ? localStorage.getItem(key) : null
  } catch {
    return null
  }
}

export function writeCachedProfileName(authId, name) {
  try {
    const key = getProfileNameCacheKey(authId)
    if (!key) return
    if (name) {
      localStorage.setItem(key, name)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    /* quota exceeded */
  }
}

export function readCachedProfileAvatar(authId) {
  try {
    const key = getProfileAvatarCacheKey(authId)
    return key ? localStorage.getItem(key) : null
  } catch {
    return null
  }
}

export function writeCachedProfileAvatar(authId, avatarId) {
  try {
    const key = getProfileAvatarCacheKey(authId)
    if (!key) return
    if (avatarId) {
      localStorage.setItem(key, avatarId)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    /* quota exceeded */
  }
}

export function getProfileBannerCacheKey(authId) {
  return authId ? `korset_profile_banner_${authId}` : null
}

export function readCachedProfileBanner(authId) {
  try {
    const key = getProfileBannerCacheKey(authId)
    return key ? localStorage.getItem(key) : null
  } catch {
    return null
  }
}

export function writeCachedProfileBanner(authId, bannerUrl) {
  try {
    const key = getProfileBannerCacheKey(authId)
    if (!key) return
    if (bannerUrl) {
      localStorage.setItem(key, bannerUrl)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    /* quota exceeded */
  }
}
