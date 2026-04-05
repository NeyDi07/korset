
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../utils/supabase.js'
import {
  getOrCreateDeviceId,
  readCachedProfileAvatar,
  readCachedProfileName,
  writeCachedProfileAvatar,
  writeCachedProfileName,
} from '../utils/userIdentity.js'

const AuthContext = createContext({ user: null, session: null, loading: true })

function buildFallbackName(authUser) {
  return authUser?.user_metadata?.full_name || authUser?.email?.split('@')?.[0] || 'Körset User'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [internalUserId, setInternalUserId] = useState(null)
  const [displayName, setDisplayName] = useState(null)
  const [avatarId, setAvatarId] = useState(null)

  const refreshAccountProfile = async (authUser = user) => {
    if (!authUser) {
      setInternalUserId(null)
      setDisplayName(null)
      setAvatarId(null)
      return null
    }

    const cachedName = readCachedProfileName(authUser.id)
    const cachedAvatar = readCachedProfileAvatar(authUser.id)
    const metadataName = authUser.user_metadata?.full_name || null
    const metadataAvatar = authUser.user_metadata?.avatar_id || authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null

    setDisplayName(cachedName || metadataName || buildFallbackName(authUser))
    setAvatarId(cachedAvatar || metadataAvatar || null)

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .eq('auth_id', authUser.id)
        .maybeSingle()

      if (error) throw error

      let row = data
      if (!row) {
        const device_id = getOrCreateDeviceId()
        const { data: inserted, error: insertError } = await supabase
          .from('users')
          .insert({
            auth_id: authUser.id,
            device_id,
            name: cachedName || metadataName || buildFallbackName(authUser),
          })
          .select('id, name')
          .single()

        if (insertError) throw insertError
        row = inserted
      }

      setInternalUserId(row?.id || null)
      const resolvedName = row?.name || cachedName || metadataName || buildFallbackName(authUser)
      setDisplayName(resolvedName)
      writeCachedProfileName(authUser.id, resolvedName)

      const resolvedAvatar = cachedAvatar || metadataAvatar || null
      setAvatarId(resolvedAvatar)
      if (resolvedAvatar) writeCachedProfileAvatar(authUser.id, resolvedAvatar)

      return row
    } catch (err) {
      console.error('Failed to resolve internal user/profile', err)
      setInternalUserId(null)
      setDisplayName(cachedName || metadataName || buildFallbackName(authUser))
      setAvatarId(cachedAvatar || metadataAvatar || null)
      return null
    }
  }

  const logout = async () => {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ])
    } catch (error) {
      console.warn('Logout warning', error)
    } finally {
      setSession(null)
      setUser(null)
      setInternalUserId(null)
      setDisplayName(null)
      setAvatarId(null)
    }
  }

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      setUser(session?.user ?? null)
      await refreshAccountProfile(session?.user ?? null)
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      await refreshAccountProfile(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      internalUserId,
      session,
      loading,
      displayName,
      avatarId,
      refreshAccountProfile,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
