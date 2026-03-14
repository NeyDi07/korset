import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  {
    id: 'home', label: 'Главная', path: '/',
    icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'rgba(167,139,250,0.3)' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5z"/>
        <path d="M9 21V13h6v8"/>
      </svg>
    ),
  },
  {
    id: 'catalog', label: 'Каталог', path: '/catalog',
    icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" fill={active ? 'rgba(167,139,250,0.3)' : 'none'}/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" fill={active ? 'rgba(167,139,250,0.3)' : 'none'}/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" fill={active ? 'rgba(167,139,250,0.3)' : 'none'}/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" fill={active ? 'rgba(167,139,250,0.3)' : 'none'}/>
      </svg>
    ),
  },
  {
    id: 'scan', label: 'Скан', path: '/scan', isScan: true,
    icon: () => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <path d="M3 7V4a1 1 0 0 1 1-1h3"/>
        <path d="M17 3h3a1 1 0 0 1 1 1v3"/>
        <path d="M21 17v3a1 1 0 0 1-1 1h-3"/>
        <path d="M7 21H4a1 1 0 0 1-1-1v-3"/>
        <line x1="7" y1="12" x2="17" y2="12" strokeWidth="2.5"/>
        <line x1="12" y1="7" x2="12" y2="17" strokeWidth="2.5"/>
      </svg>
    ),
  },
  {
    id: 'ai', label: 'AI', path: '/ai',
    icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" fill={active ? 'rgba(167,139,250,0.4)' : 'none'}/>
        <path d="M5 18l.8 2.4L8 21.2l-2.2.8L5 24.4l-.8-2.2L2 21.2l2.2-.8L5 18z" opacity="0.5" fill={active ? 'rgba(167,139,250,0.4)' : 'none'}/>
      </svg>
    ),
  },
  {
    id: 'profile', label: 'Профиль', path: '/profile',
    icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" fill={active ? 'rgba(167,139,250,0.3)' : 'none'}/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [activeId, setActiveId] = useState('home')
  const [liquidPos, setLiquidPos] = useState({ x: 0, width: 0 })
  const tabRefs = useRef({})

  const getActiveId = (path) => {
    if (path === '/' || path === '/profile') return 'profile'
    if (path === '/catalog' || path.startsWith('/product')) return 'catalog'
    if (path === '/scan') return 'scan'
    if (path === '/ai') return 'ai'
    return 'home'
  }

  useEffect(() => {
    const id = getActiveId(pathname)
    setActiveId(id)
    // Обновляем позицию жидкости
    const el = tabRefs.current[id]
    if (el) {
      const rect = el.getBoundingClientRect()
      const parentRect = el.parentElement.getBoundingClientRect()
      setLiquidPos({ x: rect.left - parentRect.left, width: rect.width })
    }
  }, [pathname])

  const handleTab = (tab) => {
    if (tab.isScan) { navigate('/scan'); return }
    if (tab.id === 'profile' || tab.id === 'home') { navigate('/'); return }
    navigate(tab.path)
  }

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '8px 8px 28px',
      background: 'rgba(8,8,18,0.97)',
      backdropFilter: 'blur(24px)',
      borderTop: '1px solid rgba(255,255,255,0.07)',
    }}>

      {/* Жидкий индикатор */}
      <div style={{
        position: 'absolute',
        top: 8,
        left: liquidPos.x,
        width: liquidPos.width,
        height: 46,
        borderRadius: 14,
        background: 'rgba(124,58,237,0.2)',
        border: '1px solid rgba(124,58,237,0.35)',
        transition: 'left 0.4s cubic-bezier(0.34,1.56,0.64,1), width 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        pointerEvents: 'none',
        zIndex: 0,
        display: activeId === 'scan' ? 'none' : 'block',
      }}/>

      {TABS.map(tab => {
        const active = activeId === tab.id

        if (tab.isScan) {
          return (
            <button
              key={tab.id}
              ref={el => tabRefs.current[tab.id] = el}
              onClick={() => handleTab(tab)}
              style={{
                width: 52, height: 52, borderRadius: 16, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(124,58,237,0.55)',
                flexShrink: 0, zIndex: 1,
                transform: 'translateY(-6px)',
                transition: 'transform 0.2s ease',
              }}
              onTouchStart={e => e.currentTarget.style.transform = 'translateY(-3px) scale(0.95)'}
              onTouchEnd={e => e.currentTarget.style.transform = 'translateY(-6px) scale(1)'}
            >
              {tab.icon({})}
            </button>
          )
        }

        return (
          <button
            key={tab.id}
            ref={el => tabRefs.current[tab.id] = el}
            onClick={() => handleTab(tab)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '8px 14px', borderRadius: 14,
              border: 'none', cursor: 'pointer', background: 'transparent',
              color: active ? '#A78BFA' : 'rgba(140,140,180,0.5)',
              zIndex: 1, position: 'relative',
              transform: active ? 'translateY(-3px)' : 'translateY(0)',
              transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), color 0.25s ease',
              minWidth: 56,
            }}
          >
            <div style={{ transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)', transform: active ? 'scale(1.15)' : 'scale(1)' }}>
              {tab.icon({ active })}
            </div>
            <span style={{
              fontSize: 10, fontWeight: active ? 700 : 500,
              fontFamily: 'var(--font-body)', letterSpacing: '0.2px',
              opacity: active ? 1 : 0.7,
              transition: 'opacity 0.25s ease, font-weight 0.25s',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
