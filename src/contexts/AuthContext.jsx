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
})

function getDeviceId() {
  let deviceId = localStorage.getItem('korset_device_id')
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('korset_device_id', deviceId)
  }
  return deviceId
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [internalUserId, setInternalUserId] = useState(null)
  const [accountProfile, setAccountProfile] = useState(null)

  const resolveInternalUser = useCallback(async (authUser) => {
    if (!authUser) {
      setInternalUserId(null)
      setAccountProfile(null)
      return null
    }

    const deviceId = getDeviceId()

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, lang, preferences')
        .eq('auth_id', authUser.id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setInternalUserId(data.id)
        setAccountProfile(data)
        return data
      }

      const fallbackName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Körset User'
      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .insert({ auth_id: authUser.id, device_id: deviceId, name: fallbackName })
        .select('id, name, lang, preferences')
        .single()

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
  }, [])

  const refreshAccountProfile = useCallback(async () => {
    if (!user) return null
    return resolveInternalUser(user)
  }, [user, resolveInternalUser])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      await resolveInternalUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      await resolveInternalUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [resolveInternalUser])

  const displayName = accountProfile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Körset User'

  return (
    <AuthContext.Provider value={{ user, session, loading, internalUserId, accountProfile, displayName, refreshAccountProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
