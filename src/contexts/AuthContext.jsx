import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabase.js'

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  internalUserId: null,
  accountProfile: null,
  displayName: 'Körset User',
  refreshAccountProfile: async () => {},
  logout: async () => {},
})

function getDeviceId() {
  let deviceId = localStorage.getItem('korset_device_id')
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('korset_device_id', deviceId)
  }
  return deviceId
}

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

function isLockAbort(error) {
  const message = String(error?.message || error || '')
  return /lock request is aborted/i.test(message)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [internalUserId, setInternalUserId] = useState(null)
  const [accountProfile, setAccountProfile] = useState(null)

  const clearAccountState = useCallback(() => {
    setSession(null)
    setUser(null)
    setInternalUserId(null)
    setAccountProfile(null)
  }, [])

  const resolveInternalUser = useCallback(async (authUser) => {
    if (!authUser) {
      clearAccountState()
      return null
    }

    const deviceId = getDeviceId()

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('users')
          .select('id, name, lang, preferences')
          .eq('auth_id', authUser.id)
          .maybeSingle(),
        8000,
      )

      if (error) throw error

      if (data) {
        setInternalUserId(data.id)
        setAccountProfile(data)
        return data
      }

      const fallbackName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Körset User'
      const { data: inserted, error: insertError } = await withTimeout(
        supabase
          .from('users')
          .upsert({ auth_id: authUser.id, device_id: deviceId, name: fallbackName }, { onConflict: 'auth_id' })
          .select('id, name, lang, preferences')
          .single(),
        8000,
      )

      if (insertError) throw insertError
      setInternalUserId(inserted?.id || null)
      setAccountProfile(inserted || null)
      return inserted || null
    } catch (err) {
      console.error('Failed to resolve internal user', err)
      setInternalUserId(null)
      setAccountProfile(null)
      return null
    }
  }, [clearAccountState])

  const refreshAccountProfile = useCallback(async () => {
    if (!user) return null
    return resolveInternalUser(user)
  }, [user, resolveInternalUser])

  const logout = useCallback(async () => {
    try {
      const { error } = await withTimeout(supabase.auth.signOut(), 6000)
      if (error) throw error
    } catch (error) {
      console.warn('signOut failed, forcing local logout', error)
      if (!isLockAbort(error)) {
        // even on non-lock errors we still drop local auth state so UI does not hang
      }
    } finally {
      clearAccountState()
      try {
        localStorage.removeItem('korset_auth_return_to')
        localStorage.removeItem('korset_auth_reason')
      } catch {}
    }
  }, [clearAccountState])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return
      setSession(session)
      setUser(session?.user ?? null)
      await resolveInternalUser(session?.user ?? null)
      if (active) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return
      setSession(session)
      setUser(session?.user ?? null)
      await resolveInternalUser(session?.user ?? null)
      if (active) setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [resolveInternalUser])

  const displayName = accountProfile?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Körset User'

  return (
    <AuthContext.Provider value={{ user, session, loading, internalUserId, accountProfile, displayName, refreshAccountProfile, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
