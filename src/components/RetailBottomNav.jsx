import { useNavigate, useLocation } from 'react-router-dom'
import { useI18n } from '../utils/i18n.js'
import { useStore } from '../contexts/StoreContext.jsx'

export default function RetailBottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { currentStore } = useStore()
  const { t } = useI18n()

  const getActive = () => {
    if (pathname.includes('/products')) return 'products'
    if (pathname.includes('/import')) return 'import'
    if (pathname.includes('/settings')) return 'settings'
    return 'dashboard'
  }

  const active = getActive()
  const col = (on) => on ? '#38BDF8' : 'rgba(148, 163, 184, 0.45)' // Retail uses a more "Sky Blue" distinct color
  const storeSlug = currentStore?.slug || 'store-one'

  const TABS = [
    {
      id: 'dashboard', label: t.retail.nav.dashboard, path: `/retail/${storeSlug}/dashboard`,
      icon: (on) => on ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={col(true)}><path d="M4 13h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1zm0 8h6a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1zm10 0h6a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1zM14 4v4a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1z"/></svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={col(false)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
      ),
    },
    {
      id: 'products', label: t.retail.nav.products, path: `/retail/${storeSlug}/products`,
      icon: (on) => on ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={col(true)}><path d="M12 2l-9 4v12l9 4 9-4V6l-9-4zm0 2.3l6.3 2.8-6.3 2.8-6.3-2.8L12 4.3zm-7.5 13.1V8l6.5 2.9v9.2l-6.5-2.7zm15 0l-6.5 2.7v-9.2L19.5 8v9.4z"/></svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={col(false)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
      ),
    },
    {
      id: 'import', label: t.retail.nav.import, path: `/retail/${storeSlug}/import`,
      icon: (on) => on ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={col(true)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15.01l1.41 1.41L11 14.83V19h2v-4.17l1.59 1.59L16 15.01 12 11l-4 4.01z"/></svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={col(false)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
      ),
    },
    {
      id: 'settings', label: t.retail.nav.settings, path: `/retail/${storeSlug}/settings`,
      icon: (on) => on ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={col(true)}><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.73 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .43-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.49-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={col(false)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      ),
    },
  ]

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', alignItems: 'end',
      columnGap: 4,
      padding: `8px 8px calc(12px + env(safe-area-inset-bottom, 0px))`,
      background: 'rgba(8,12,24,0.97)', // Slightly bluer tint for retail
      backdropFilter: 'blur(24px)',
      borderTop: '1px solid rgba(56, 189, 248, 0.15)', // Blue tint border
    }}>
      {TABS.map((tab) => {
        const on = active === tab.id

        return (
          <button key={tab.id} onClick={() => navigate(tab.path)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-end', gap: 4,
            width: '100%', minWidth: 0, height: 52,
            padding: '6px 4px', borderRadius: 12,
            border: 'none', cursor: 'pointer',
            background: 'transparent',
          }}>
            <div style={{ transition: 'transform 0.2s', transform: on ? 'translateY(-2px)' : 'none' }}>
              {tab.icon(on)}
            </div>
            <span style={{
              fontSize: 10.5, fontWeight: on ? 700 : 500,
              color: col(on),
              fontFamily: 'var(--font-body)',
              transition: 'color 0.2s',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              textAlign: 'center',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
