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
export default function TermsConsentSheet({ open, onAccept, onNavigateTerms, onNavigatePolicy }) {
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
          padding: '0 24px calc(28px + env(safe-area-inset-bottom))',
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

        {/* Icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
            color: 'var(--text)',
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>

        {/* Title */}
        <div
          id="consent-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            color: 'var(--text)',
            marginBottom: 10,
          }}
        >
          Прежде чем начать
        </div>

        {/* Body */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            lineHeight: 1.65,
            color: 'var(--text-sub)',
            margin: '0 0 20px',
          }}
        >
          Körset предоставляет информацию о составе товаров в справочных целях.{' '}
          <strong style={{ color: 'var(--text)' }}>
            Данные не заменяют проверку упаковки и не являются медицинской рекомендацией.
          </strong>{' '}
          Ответственность за конечный выбор продукта лежит на вас.
        </p>

        {/* Legal links */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            marginBottom: 24,
          }}
        >
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)' }}>
            Нажимая «Принять», вы соглашаетесь с
          </span>
          <button
            type="button"
            onClick={onNavigateTerms}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--primary)',
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
              textUnderlineOffset: 2,
            }}
          >
            условиями использования
          </button>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)' }}>
            и
          </span>
          <button
            type="button"
            onClick={onNavigatePolicy}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--primary)',
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
              textUnderlineOffset: 2,
            }}
          >
            политикой конфиденциальности
          </button>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)' }}>
            .
          </span>
        </div>

        {/* Accept button */}
        <button
          type="button"
          id="consent-accept-btn"
          onClick={handleAccept}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: 14,
            border: 'none',
            background: 'var(--text)',
            color: 'var(--bg-app)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: 0.2,
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
