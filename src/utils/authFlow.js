const AUTH_RETURN_TO_KEY = "korset_auth_return_to"

function safeStorage() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function normalizeReturnTo(path) {
  if (!path || typeof path !== 'string') return '/'
  if (!path.startsWith('/')) return '/'
  if (path.startsWith('/auth')) return '/profile'
  return path
}

export function getCurrentPath(location) {
  if (!location) return '/'
  return `${location.pathname || ''}${location.search || ''}${location.hash || ''}` || '/'
}

export function saveAuthReturnTo(path) {
  const storage = safeStorage()
  if (!storage) return
  storage.setItem(AUTH_RETURN_TO_KEY, normalizeReturnTo(path))
}

export function readAuthReturnTo() {
  const storage = safeStorage()
  if (!storage) return null
  return normalizeReturnTo(storage.getItem(AUTH_RETURN_TO_KEY))
}

export function consumeAuthReturnTo(fallback = '/') {
  const storage = safeStorage()
  const value = readAuthReturnTo() || fallback
  if (storage) storage.removeItem(AUTH_RETURN_TO_KEY)
  return value
}

export function navigateToAuth(navigate, location, options = {}) {
  const returnTo = normalizeReturnTo(options.returnTo || getCurrentPath(location))
  saveAuthReturnTo(returnTo)
  navigate('/auth', { state: { returnTo }, replace: Boolean(options.replace) })
}
