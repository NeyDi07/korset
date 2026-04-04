import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../utils/supabase.js'

const AuthContext = createContext({ user: null, session: null, loading: true })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  const [internalUserId, setInternalUserId] = useState(null)

  useEffect(() => {
    const fetchInternalUser = async (authUser) => {
      if (!authUser) {
        setInternalUserId(null)
        return
      }
      try {
        const { data } = await supabase.from('users').select('id').eq('auth_id', authUser.id).maybeSingle()
        if (data) {
          setInternalUserId(data.id)
        } else {
          // Fallback: get device ID for creation
          let device_id = localStorage.getItem('korset_device_id')
          if (!device_id) {
            device_id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
            localStorage.setItem('korset_device_id', device_id)
          }
          // Attempt to create
          const { data: inserted, error } = await supabase.from('users')
            .insert({ auth_id: authUser.id, device_id, name: authUser.user_metadata?.full_name || 'User' })
            .select('id').single()
          
          if (error) {
            console.error('Failed to create users row:', error.message, error.details || error.hint)
          }
          setInternalUserId(inserted?.id || null)
        }
      } catch (err) {
        console.error('Failed to resolve internal user', err)
      }
    }

    // Получаем текущую сессию при загрузке
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      fetchInternalUser(session?.user ?? null).finally(() => setLoading(false))
    })

    // Слушаем изменения авторизации (логин/логаут)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      fetchInternalUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, internalUserId, session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
