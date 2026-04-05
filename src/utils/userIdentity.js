
export function getOrCreateDeviceId() {
  try {
    const key = 'korset_device_id'
    let value = localStorage.getItem(key)
    if (!value) {
      value = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem(key, value)
    }
    return value
  } catch {
    return 'dev_fallback_' + Date.now().toString(36)
  }
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
    if (name) localStorage.setItem(key, name)
  } catch {}
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
    if (avatarId) localStorage.setItem(key, avatarId)
  } catch {}
}
