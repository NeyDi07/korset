// TermsConsentSheet — одноразовая шторка согласия перед первым сканом.
//
// Логика:
//   - При первом открытии ScanScreen проверяется localStorage 'korset_terms_accepted'
//   - Если ключа нет — шторка открывается. Закрыть без согласия нельзя.
//   - После нажатия «Принять» сохраняется { accepted: true, at: ISO-дата }.
//
// Для ТЕСТИРОВАНИЯ (временно): кнопка «Сбросить согласие» в ProfileScreen позволяет
// вернуть шторку — она вынесена в ProfileScreen как dev-утилита.

const STORAGE_KEY = 'korset_terms_accepted'

export function isTermsAccepted() {
  try {
    return Boolean(JSON.parse(localStorage.getItem(STORAGE_KEY))?.accepted)
  } catch {
    return false
  }
}

export function resetTermsAccepted() {
  localStorage.removeItem(STORAGE_KEY)
}

function markTermsAccepted() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ accepted: true, at: new Date().toISOString() })
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
import { useState } from 'react'

export default function TermsConsentSheet({ open, onAccept, onNavigateTerms, onNavigatePolicy }) {
  const [checked, setChecked] = useState(false)

  if (!open) return null

  const handleAccept = () => {
    markTermsAccepted()
    onAccept()
  }

  return (
    <>
      {/* Backdrop — intentionally not clickable, forces deliberate choice */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 400,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
        }}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 401,
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--glass-border)',
          borderRadius: '20px 20px 0 0',
          padding: '0 24px calc(96px + env(safe-area-inset-bottom))', // 96px accommodates bottom nav height
          animation: 'tcSlideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 32,
            height: 4,
            borderRadius: 999,
            background: 'var(--glass-soft-border)',
            margin: '14px auto 28px',
          }}
        />

        {/* Title & Icon Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--glass-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text)',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div
            id="consent-title"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            Прежде чем начать
          </div>
        </div>

        {/* Body */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text-sub)',
            margin: '0 0 24px',
          }}
        >
          Körset предоставляет информацию о составе товаров в справочных целях.{' '}
          <strong style={{ color: 'var(--text)', fontWeight: 600 }}>
            Данные не заменяют проверку упаковки и не являются медицинской рекомендацией.
          </strong>{' '}
          Ответственность за конечный выбор продукта лежит на вас.
        </p>

        {/* Checkbox Row */}
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 28,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: checked ? '1.5px solid var(--primary)' : '1.5px solid var(--text-disabled)',
              background: checked ? 'var(--primary)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 2,
              transition: 'all 0.2s ease',
            }}
          >
            {checked && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.5,
            }}
          >
            Я ознакомился(ась) и согласен(сна) с{' '}
            <span
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onNavigateTerms()
              }}
              style={{ color: 'var(--text)', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              условиями использования
            </span>{' '}
            и{' '}
            <span
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onNavigatePolicy()
              }}
              style={{ color: 'var(--text)', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              политикой конфиденциальности
            </span>
            .
          </div>
        </label>

        {/* Accept button */}
        <button
          type="button"
          id="consent-accept-btn"
          disabled={!checked}
          onClick={handleAccept}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 14,
            border: 'none',
            background: checked ? 'var(--text)' : 'var(--glass-soft-border)',
            color: checked ? 'var(--bg-app)' : 'var(--text-disabled)',
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 700,
            cursor: checked ? 'pointer' : 'not-allowed',
            letterSpacing: 0.3,
            transition: 'all 0.2s ease',
          }}
        >
          Принять и продолжить
        </button>
      </div>

      <style>{`
        @keyframes tcSlideUp {
          from { transform: translateY(100%) }
          to   { transform: translateY(0)    }
        }
      `}</style>
    </>
  )
}
