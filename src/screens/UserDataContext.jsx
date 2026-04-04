import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../utils/supabase.js'
import { useAuth } from './AuthContext.jsx'

const UserDataContext = createContext()
const LOCAL_SCAN_KEY = 'korset_local_scan_count'

function getLocalScanCount() {
  const raw = localStorage.getItem(LOCAL_SCAN_KEY)
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

function setLocalScanCount(value) {
  localStorage.setItem(LOCAL_SCAN_KEY, String(Math.max(0, value)))
}

export function UserDataProvider({ children }) {
  const { user, internalUserId } = useAuth()
  const [favoriteEans, setFavoriteEans] = useState(new Set())
  const [scanCount, setScanCount] = useState(() => getLocalScanCount())
  const [userDataLoaded, setUserDataLoaded] = useState(false)

  useEffect(() => {
    if (!user || !internalUserId) {
      setFavoriteEans(new Set())
      setScanCount(getLocalScanCount())
      setUserDataLoaded(true)
      return
    }

    setUserDataLoaded(false)
    const loadIdentifiers = async () => {
      let remoteScanCount = null
      try {
        const { data: favs } = await supabase.from('user_favorites').select('ean').eq('user_id', internalUserId)
        if (favs) setFavoriteEans(new Set(favs.map((f) => f.ean)))

        const { count, error } = await supabase
          .from('scan_events')
          .select('ean', { count: 'exact', head: true })
          .eq('user_id', internalUserId)

        if (!error && typeof count === 'number') {
          remoteScanCount = count
        }
      } catch (err) {
        console.error('Failed to load user data cache', err)
      }

      const localCount = getLocalScanCount()
      const finalCount = Math.max(localCount, remoteScanCount ?? 0)
      setScanCount(finalCount)
      setLocalScanCount(finalCount)
      setUserDataLoaded(true)
    }

    loadIdentifiers()
  }, [user, internalUserId])

  const checkIsFavorite = (ean) => {
    if (!ean) return false
    return favoriteEans.has(ean)
  }

  const toggleFavorite = async (product) => {
    if (!internalUserId) {
      alert('Не удалось загрузить ваш профиль. Попробуйте перезайти в аккаунт.')
      return
    }
    if (!product || !product.ean) return

    const ean = product.ean
    const isFav = favoriteEans.has(ean)

    setFavoriteEans((prev) => {
      const next = new Set(prev)
      if (isFav) next.delete(ean)
      else next.add(ean)
      return next
    })

    try {
      if (!isFav) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const validGlobalId = uuidRegex.test(product.id) ? product.id : null

        const { error } = await supabase.from('user_favorites').upsert({
          user_id: internalUserId,
          global_product_id: validGlobalId,
          ean,
        }, { onConflict: 'user_id, ean' })
        if (error) throw error
      } else {
        const { error } = await supabase.from('user_favorites').delete().eq('user_id', internalUserId).eq('ean', ean)
        if (error) throw error
      }
    } catch (err) {
      console.error('Toggle favorite failed', err)
      alert('Ошибка базы данных: ' + err.message)
      setFavoriteEans((prev) => {
        const next = new Set(prev)
        if (isFav) next.add(ean)
        else next.delete(ean)
        return next
      })
      throw err
    }
  }

  const incrementScanCount = () => {
    setScanCount((prev) => {
      const next = prev + 1
      setLocalScanCount(next)
      return next
    })
  }

  useEffect(() => {
    const handleScanAdded = () => incrementScanCount()
    window.addEventListener('korset:scan_added', handleScanAdded)
    return () => window.removeEventListener('korset:scan_added', handleScanAdded)
  }, [])

  return (
    <UserDataContext.Provider value={{
      favoriteEans,
      checkIsFavorite,
      toggleFavorite,
      favoritesCount: favoriteEans.size,
      scanCount,
      incrementScanCount,
      userDataLoaded,
    }}>
      {children}
    </UserDataContext.Provider>
  )
}

export const useUserData = () => useContext(UserDataContext)
