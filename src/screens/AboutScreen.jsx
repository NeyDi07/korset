import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'

const APP_VERSION = '1.0.0'
const APP_YEAR = new Date().getFullYear()

// ─── Feature list ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <path d="M3 17h4v4H3z" />
      </svg>
    ),
    title: 'Умный сканер',
    desc: 'Мгновенное считывание штрихкодов — наводите камеру и получайте результат без нажатий',
  },
  {
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    title: 'Персональный Fit-Check',
    desc: 'Аллергены, Халал-статус и диетические цели — всё сразу на одном экране',
  },
  {
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    title: 'Избранное',
    desc: 'Сохраняйте любимые товары и возвращайтесь к ним в любое время',
  },
  {
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
        <path d="M8 2v16M16 6v16" />
      </svg>
    ),
    title: 'База товаров КЗ',
    desc: 'Тысячи товаров казахстанских магазинов с актуальными данными о составе',
  },
  {
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
    title: 'История сканирований',
    desc: 'Все отсканированные товары сохраняются для быстрого доступа',
  },
  {
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'Приватность',
    desc: 'Данные о ваших аллергенах хранятся локально и не передаются третьим лицам',
  },
]

// ─── Tech stack row ───────────────────────────────────────────────────────────
function TechBadge({ label }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '5px 12px',
        borderRadius: 999,
        border: '1px solid var(--glass-soft-border)',
        background: 'var(--glass-muted)',
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        color: 'var(--text-sub)',
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AboutScreen() {
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <div
      className="screen"
      style={{
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'calc(48px + env(safe-area-inset-bottom))',
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
            {t('profile.about')}
          </div>
        </div>
        <div style={{ width: 44 }} />
      </div>

      {/* ── Hero logo block ── */}
      <div style={{ padding: '0 22px 24px' }}>
        <div
          className="glass-card"
          style={{
            padding: '32px 24px',
            textAlign: 'center',
            background: 'linear-gradient(145deg, rgba(124,58,237,0.1), rgba(236,72,153,0.07))',
            border: '1px solid rgba(124,58,237,0.2)',
          }}
        >
          {/* Logo circle */}
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              background: 'linear-gradient(135deg, #7C3AED, #EC4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 12px 40px rgba(124,58,237,0.35)',
            }}
          >
            {/* K lettermark */}
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
              <text
                x="6"
                y="29"
                fontFamily="'Bebas Neue', sans-serif"
                fontSize="30"
                fill="#fff"
                letterSpacing="1"
              >
                K
              </text>
            </svg>
          </div>

          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              letterSpacing: 2,
              color: 'var(--text)',
              marginBottom: 4,
            }}
          >
            KÖRSET
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--text-sub)',
              marginBottom: 16,
            }}
          >
            Умный помощник в магазине
          </div>

          {/* Version badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              borderRadius: 999,
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.25)',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#34d399',
                boxShadow: '0 0 8px rgba(52,211,153,0.6)',
                display: 'inline-block',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              Версия {APP_VERSION}
            </span>
          </div>
        </div>
      </div>

      {/* ── Mission ── */}
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
          Наша миссия
        </div>
        <div className="glass-card" style={{ padding: '20px 22px' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--text-sub)',
              margin: 0,
            }}
          >
            Körset создан, чтобы каждый покупатель в Казахстане мог уверенно выбирать продукты —
            зная их реальный состав, безопасность для здоровья и соответствие личным диетическим
            предпочтениям. Мы верим, что осознанный выбор еды начинается с доступной и честной
            информации.
          </p>
        </div>
      </div>

      {/* ── Features grid ── */}
      <div style={{ padding: '24px 22px 8px' }}>
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
          Возможности
        </div>
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '16px 20px',
                borderBottom:
                  i < FEATURES.length - 1 ? '1px solid var(--glass-soft-border)' : 'none',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'rgba(124,58,237,0.1)',
                  border: '1px solid rgba(124,58,237,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'var(--primary)',
                }}
              >
                {f.icon}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text)',
                    marginBottom: 3,
                  }}
                >
                  {f.title}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: 'var(--text-sub)',
                  }}
                >
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tech stack ── */}
      <div style={{ padding: '24px 22px 8px' }}>
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
          Технологии
        </div>
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['React 18', 'Supabase', 'Vercel', 'OpenAI', 'PWA', 'Vite'].map((t) => (
              <TechBadge key={t} label={t} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer copyright ── */}
      <div style={{ padding: '28px 22px 0', textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--text-disabled)',
            lineHeight: 1.6,
          }}
        >
          © {APP_YEAR} Körset. Все права защищены.
          <br />
          Разработано в Казахстане 🇰🇿
        </div>
      </div>
    </div>
  )
}
