import { createContext, useContext, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const StoreContext = createContext({ storeId: null })

export function StoreProvider({ children }) {
  const [storeId, setStoreId] = useState(() => localStorage.getItem('korset_store_id'))
  const location = useLocation()

  useEffect(() => {
    // Извлекаем магазин из URL (например: ?store=MAGNUM_01)
    const params = new URLSearchParams(window.location.search)
    const store = params.get('store')?.toUpperCase()
    
    if (store) {
      setStoreId(store)
      localStorage.setItem('korset_store_id', store)
      
      // Очищаем URL, чтобы он выглядел чисто (опционально)
      // window.history.replaceState({}, '', window.location.pathname)
    }
  }, [location.search])

  return (
    <StoreContext.Provider value={{ storeId }}>
      {children}
    </StoreContext.Provider>
  )
}

// Хук для доступа к storeId из любого компонента
export function useStoreId() {
  return useContext(StoreContext).storeId
}
