import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useI18n } from '../utils/i18n.js'
import { supabase } from '../utils/supabase.js'
import { buildProfilePath } from '../utils/routes.js'

function formatDate(iso, lang) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const opts = { day: 'numeric', month: 'long', year: 'numeric' }
  return d.toLocaleDateString(lang === 'kz' ? 'kk-KZ' : 'ru-RU', opts)
}

function FieldRow({ label, value, monospace = false }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '14px 0',
        borderBottom: '1px solid var(--glass-soft-border)',
        gap: 16,
      }}
    >
      <span
        style={{
          fontSize: 14,
          color: 'var(--text-sub)',
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          color: 'var(--text)',
          fontWeight: 600,
          fontFamily: monospace ? 'monospace' : undefined,
          wordBreak: 'break-all',
          textAlign: 'right',
          maxWidth: '60%',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function ActionRow({ icon, label, danger = false, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 0',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--glass-soft-border)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: danger ? 'var(--error-bright)' : 'var(--text)',
        opacity: disabled ? 0.5 : 1,
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon}
        {label}
      </span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}

function InfoBox({ children, tone = 'default' }) {
  const tones = {
    default: {
      bg: 'var(--glass-bg)',
      border: 'var(--glass-border)',
      text: 'var(--text-sub)',
    },
    success: {
      bg: 'var(--success-dim)',
      border: 'rgba(5,150,105,0.3)',
      text: 'var(--success-bright)',
    },
    warning: {
      bg: 'var(--error-dim)',
      border: 'rgba(220,38,38,0.3)',
      text: 'var(--error-bright)',
    },
  }
  const t = tones[tone] || tones.default
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: t.bg,
        border: `1px solid ${t.border}`,
        fontSize: 13,
        color: t.text,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  )
}

export default function AccountScreen() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { currentStore } = useStore()
  const { lang, t } = useI18n()
  const tr = (val) => (typeof val === 'object' ? val[lang] || val.ru : val)

  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  if (!user) {
    navigate('/auth', { replace: true })
    return null
  }

  const email = user.email || ''
  const createdAt = user.created_at || user.createdAt || ''
  const userId = user.id || ''
  const isStoreOwner = currentStore?.owner_id === user.id

  const handleResetPassword = async () => {
    if (!email) return
    setResetLoading(true)
    setResetError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`,
      })
      if (error) throw error
      setResetSent(true)
    } catch (err) {
      setResetError(err?.message || tr(t.account?.resetError) || 'Ошибка')
    } finally {
      setResetLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate(buildProfilePath(currentStore?.slug || null), { replace: true })
  }

  const backTarget = buildProfilePath(currentStore?.slug || null)

  return (
    <div
      className="screen"
      style={{
        background: 'var(--bg-app)',
        minHeight: '100vh',
        paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Sticky Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--glass-strong)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--glass-border)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate(backTarget)}
          aria-label={t.common?.back || 'Назад'}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'var(--glass-muted)',
            border: '1px solid var(--glass-soft-border)',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'center',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {tr(t.account?.title) || 'Личные данные'}
        </div>
        <div style={{ width: 38 }} />
      </div>

      {/* Content */}
      <div style={{ padding: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Account Info Card */}
        <div
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid var(--glass-border)',
            borderRadius: 24,
            padding: '20px 22px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 8,
              paddingLeft: 4,
            }}
          >
            {tr(t.account?.sectionAccount) || 'Аккаунт'}
          </div>

          <FieldRow label={tr(t.account?.emailLabel) || 'Email'} value={email || '—'} />
          <FieldRow
            label={tr(t.account?.joinedLabel) || 'Дата регистрации'}
            value={formatDate(createdAt, lang)}
          />
          <FieldRow label={tr(t.account?.idLabel) || 'ID пользователя'} value={userId} monospace />
        </div>

        {/* Store Status */}
        {isStoreOwner && currentStore && (
          <div
            style={{
              background: 'var(--success-dim)',
              border: '1px solid rgba(5,150,105,0.3)',
              borderRadius: 24,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--success-bright)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M20 7l-8 10-5-5" />
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success-bright)' }}>
                {tr(t.account?.storeOwnerTitle) || 'Владелец магазина'}
              </div>
              <div
                style={{ fontSize: 12, color: 'var(--success-bright)', opacity: 0.8, marginTop: 2 }}
              >
                {currentStore.name || currentStore.slug}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid var(--glass-border)',
            borderRadius: 24,
            padding: '6px 22px 20px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 4,
              marginTop: 14,
              paddingLeft: 4,
            }}
          >
            {tr(t.account?.sectionSecurity) || 'Безопасность'}
          </div>

          <ActionRow
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--primary-bright)"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            }
            label={tr(t.account?.changePassword) || 'Сменить пароль'}
            onClick={handleResetPassword}
            disabled={resetLoading || resetSent || !email}
          />

          {resetSent && (
            <InfoBox tone="success">
              {tr(t.account?.resetSent) || 'Ссылка для сброса отправлена на ваш email'}
            </InfoBox>
          )}
          {resetError && <InfoBox tone="warning">{resetError}</InfoBox>}

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: 4,
              marginTop: 14,
              paddingLeft: 4,
            }}
          >
            {tr(t.account?.sectionDanger) || 'Опасная зона'}
          </div>

          <ActionRow
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--error-bright)"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            }
            label={tr(t.account?.logout) || 'Выйти из аккаунта'}
            danger
            onClick={handleLogout}
          />
        </div>
      </div>
    </div>
  )
}
