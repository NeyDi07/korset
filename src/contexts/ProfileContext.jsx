import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { supabase } from '../utils/supabase.js'
import { DEFAULT_NOTIFICATION_SETTINGS, loadNotificationSettings, saveNotificationSettings } from '../utils/notificationSettings.js'

const ProfileContext = createContext(null)

const DEFAULT_PROFILE = {
  halal: false,
  dietGoals: [],
  allergens: [],
  customAllergens: [],
  priority: 'balanced',
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
}

function normalizeProfile(raw) {
  const profile = { ...DEFAULT_PROFILE, ...(raw || {}) }
  profile.notifications = { ...DEFAULT_NOTIFICATION_SETTINGS, ...(raw?.notifications || {}), ...loadNotificationSettings() }
  return profile
}

function loadProfileLocal() {
  try {
    const raw = localStorage.getItem('korset_profile')
    return raw ? normalizeProfile(JSON.parse(raw)) : normalizeProfile(DEFAULT_PROFILE)
  } catch {
    return normalizeProfile(DEFAULT_PROFILE)
  }
}

export function ProfileProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfileState] = useState(loadProfileLocal)

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('preferences').eq('auth_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!error && data?.preferences) {
          const mergedPrefs = normalizeProfile(data.preferences)
          setProfileState(mergedPrefs)
          localStorage.setItem('korset_profile', JSON.stringify(mergedPrefs))
          saveNotificationSettings(mergedPrefs.notifications)
        }
      })
  }, [user])

  const updateProfile = async (newProfile) => {
    let merged
    setProfileState(prev => {
      merged = normalizeProfile({ ...prev, ...newProfile, notifications: { ...prev.notifications, ...(newProfile?.notifications || {}) } })
      localStorage.setItem('korset_profile', JSON.stringify(merged))
      saveNotificationSettings(merged.notifications)
      return merged
    })

    if (user && merged) {
      await supabase.from('users').update({ preferences: merged }).eq('auth_id', user.id)
    }
  }

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'korset_profile') setProfileState(loadProfileLocal())
      if (e.key === 'korset_notification_settings') {
        setProfileState(prev => normalizeProfile({ ...prev, notifications: loadNotificationSettings() }))
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
