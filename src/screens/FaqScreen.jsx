import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'

// ─── FAQ data — buyers only ───────────────────────────────────────────────────
// FAQ data lives in locales/faq.json

// ─── Accordion item ──────────────────────────────────────────────────────────
function FaqItem({ item, open, onToggle, isLast }) {
  return (
    <div
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--glass-soft-border)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '17px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.45,
            color: open ? 'var(--primary)' : 'var(--text)',
            flex: 1,
            transition: 'color 0.2s ease',
          }}
        >
          {item.q}
        </span>
        <span
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '1.5px solid var(--glass-soft-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: open ? 'var(--primary)' : 'transparent',
            transition: 'all 0.25s ease',
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke={open ? '#fff' : 'var(--text-sub)'}
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </span>
      </button>

      {/* Animated answer panel */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: open ? 400 : 0,
          opacity: open ? 1 : 0,
          transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
        }}
      >
        <div
          style={{
            padding: '0 20px 18px',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            lineHeight: 1.65,
            color: 'var(--text-sub)',
          }}
        >
          {item.a}
        </div>
      </div>
    </div>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function FaqScreen() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [openIndex, setOpenIndex] = useState(null)
  const [supportOpen, setSupportOpen] = useState(false)

  const items = Array.from({ length: 10 }, (_, i) => ({
    q: t('faq.items.' + i + '.q'),
    a: t('faq.items.' + i + '.a'),
  }))
  const toggle = (i) => setOpenIndex((prev) => (prev === i ? null : i))

  return (
    <>
      <div
        className="screen"
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          paddingBottom: 'calc(100px + env(safe-area-inset-bottom))',
          overflowY: 'auto',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 22px 20px',
          }}
        >
          <button
            onClick={() => navigate(-1)}
            aria-label={t('common.back')}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              border: '1px solid var(--glass-soft-border)',
              background: 'var(--glass-muted)',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                letterSpacing: 0.5,
                color: 'var(--text)',
              }}
            >
              {t('faq.title')}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: 'var(--text-dim)',
                marginTop: 2,
              }}
            >
              FAQ
            </div>
          </div>

          <div style={{ width: 44 }} />
        </div>

        {/* ── Hero intro ── */}
        <div style={{ padding: '0 22px 24px' }}>
          <div
            className="glass-card"
            style={{
              padding: '20px 22px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(236,72,153,0.12))',
                border: '1px solid rgba(124,58,237,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginBottom: 5,
                }}
              >
                {t('faq.heroTitle')}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: 'var(--text-sub)',
                }}
              >
                Собрали самые частые вопросы о работе Körset. Нажмите на вопрос, чтобы раскрыть
                ответ.
              </div>
            </div>
          </div>
        </div>

        {/* ── Accordion ── */}
        <div style={{ padding: '0 22px 8px' }}>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-disabled)',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginBottom: 10,
            }}
          >
            {t('faq.sectionLabel')}
          </div>
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.map((item, i) => (
              <FaqItem
                key={i}
                item={item}
                open={openIndex === i}
                onToggle={() => toggle(i)}
                isLast={i === items.length - 1}
              />
            ))}
          </div>
        </div>

        {/* ── CTA: contact support ── */}
        <div style={{ padding: '24px 22px 0' }}>
          <div
            className="glass-card"
            style={{
              padding: '22px',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(236,72,153,0.06))',
              border: '1px solid rgba(124,58,237,0.2)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 6,
              }}
            >
              {t('faq.supportTitle')}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--text-sub)',
                marginBottom: 16,
              }}
            >
              Наша команда поддержки готова помочь. Напишите нам — мы отвечаем в течение нескольких
              часов.
            </div>
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 18px',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
                color: '#fff',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%',
                justifyContent: 'center',
              }}
            >
              {/* Telegram paper-plane icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              {t('faq.supportButton')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Support Bottom Sheet ── */}
      {supportOpen && <SupportSheet onClose={() => setSupportOpen(false)} />}
    </>
  )
}

// ─── Support Bottom Sheet (inline, used from FAQ CTA) ────────────────────────
function SupportSheet({ onClose, t }) {
  const handleTelegram = () => {
    window.open('https://t.me/korset_support', '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: 'rgba(4,6,14,0.7)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 301,
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--glass-border)',
          borderRadius: '22px 22px 0 0',
          padding: '8px 24px calc(32px + env(safe-area-inset-bottom))',
          animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 999,
            background: 'var(--glass-soft-border)',
            margin: '12px auto 24px',
          }}
        />

        {/* Telegram icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #2AABEE, #229ED9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
            boxShadow: '0 8px 24px rgba(42,171,238,0.3)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
        </div>

        <div
          style={{
            textAlign: 'center',
            marginBottom: 8,
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            color: 'var(--text)',
          }}
        >
          Поддержка Körset
        </div>
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text-sub)',
            marginBottom: 28,
            padding: '0 8px',
          }}
        >
          {t('faq.supportSheetDesc')}
        </div>

        {/* Telegram button */}
        <button
          type="button"
          onClick={handleTelegram}
          style={{
            width: '100%',
            padding: '15px',
            borderRadius: 16,
            border: 'none',
            background: 'linear-gradient(135deg, #2AABEE, #229ED9)',
            color: '#fff',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            boxShadow: '0 4px 20px rgba(42,171,238,0.25)',
            marginBottom: 12,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
          {t('faq.supportSheetBtn')}
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 16,
            border: '1px solid var(--glass-soft-border)',
            background: 'transparent',
            color: 'var(--text-sub)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('faq.supportSheetClose')}
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </>
  )
}
