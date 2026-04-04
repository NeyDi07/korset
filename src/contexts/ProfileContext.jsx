import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { supabase } from '../utils/supabase.js'

const ProfileContext = createContext(null)

const DEFAULT_PROFILE = {
  halal: false,
  dietGoals: [],
  allergens: [],
  customAllergens: [],
  priority: 'balanced' // 'balanced', 'price', 'quality'
}

function loadProfileLocal() {
  try {
    const raw = localStorage.getItem('korset_profile')
    return raw ? JSON.parse(raw) : DEFAULT_PROFILE
  } catch {
    return DEFAULT_PROFILE
  }
}

export function ProfileProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfileState] = useState(loadProfileLocal)

  // Загрузка настроек с сервера при входе в аккаунт
  useEffect(() => {
    if (!user) return
    supabase.from('users').select('preferences').eq('auth_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!error && data?.preferences) {
          setProfileState(data.preferences)
          localStorage.setItem('korset_profile', JSON.stringify(data.preferences))
        }
      })
  }, [user])

  // Обновление: пишем в стейт, localStorage, и если есть юзер — в Supabase
  const updateProfile = async (newProfile) => {
    let merged
    setProfileState(prev => {
      merged = { ...prev, ...newProfile }
      localStorage.setItem('korset_profile', JSON.stringify(merged))
      return merged
    })
    
    if (user && merged) {
      await supabase.from('users').update({ preferences: merged }).eq('auth_id', user.id)
    }
  }

  // Слушаем изменения localStorage из других вкладок
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'korset_profile') {
        setProfileState(loadProfileLocal())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <ProfileContext.Provider value={{ profile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
