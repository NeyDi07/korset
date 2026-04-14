import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../utils/supabase.js'
import { buildAuthNavigateState } from '../utils/authFlow.js'

const spinStyle = {
  width: 36,
  height: 36,
  border: '3px solid rgba(56,189,248,0.15)',
  borderTop: '3px solid #38BDF8',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
}

function FullScreenLoader({ label }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#080C18',
      }}
    >
      <div style={spinStyle} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      {label && (
        <div
          style={{ fontSize: 13, color: 'rgba(180,180,210,0.5)', fontFamily: 'var(--font-body)' }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

function NoStoreScreen({ userEmail }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        gap: 20,
        background: '#080C18',
        textAlign: 'center',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 56, color: 'rgba(56,189,248,0.5)' }}
      >
        storefront
      </span>
      <div
        style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: '#fff' }}
      >
        Магазин не найден
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.7, maxWidth: 300 }}>
        Аккаунт <b style={{ color: '#E9D5FF' }}>{userEmail}</b> не привязан ни к одному магазину
        Körset.
      </div>
      <div style={{ fontSize: 13, color: 'rgba(180,180,210,0.4)', lineHeight: 1.6, maxWidth: 300 }}>
        Если вы хотите подключить ваш магазин — напишите нам, мы настроим доступ вручную на этапе
        пилота.
      </div>
      <a
        href="mailto:hello@korset.kz"
        style={{
          marginTop: 8,
          padding: '14px 28px',
          borderRadius: 14,
          background: 'rgba(56,189,248,0.1)',
          border: '1px solid rgba(56,189,248,0.25)',
          color: '#38BDF8',
          fontSize: 14,
          fontWeight: 700,
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'var(--font-display)',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          mail
        </span>
        Написать нам
      </a>
      <a
        href="/"
        style={{
          fontSize: 12,
          color: 'rgba(180,180,210,0.35)',
          textDecoration: 'none',
          marginTop: 4,
        }}
      >
        ← На главную
      </a>
    </div>
  )
}

export default function RetailEntryScreen() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState('idle') // idle | fetching | not_found

  useEffect(() => {
    if (authLoading || !user) return

    setStatus('fetching')
    supabase
      .from('stores')
      .select('code, name')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data?.code) {
          navigate(`/retail/${data.code}/dashboard`, { replace: true })
        } else {
          setStatus('not_found')
        }
      })
  }, [user, authLoading, navigate])

  if (authLoading) return <FullScreenLoader label="Проверяем доступ..." />

  if (!user) {
    return (
      <Navigate
        to="/auth"
        state={{
          ...buildAuthNavigateState(location, {}, '/retail'),
          returnTo: '/retail',
          reason: 'retail_required',
        }}
        replace
      />
    )
  }

  if (status === 'not_found') return <NoStoreScreen userEmail={user.email} />

  return <FullScreenLoader label="Открываем кабинет..." />
}
