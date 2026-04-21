import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '../contexts/StoreContext.jsx'
import { useI18n } from '../utils/i18n.js'

const CONTACTS = [
  {
    key: 'phone',
    icon: 'call',
    color: '#4ADE80',
    label: 'Телефон',
    href: (v) => `tel:${v.replace(/[^\d+]/g, '')}`,
  },
  {
    key: 'whatsapp_number',
    icon: 'chat',
    color: '#25D366',
    label: 'WhatsApp',
    href: (v) => `https://wa.me/${v.replace(/\D/g, '')}`,
  },
  {
    key: 'instagram_url',
    icon: 'photo_camera',
    color: '#E1306C',
    label: 'Instagram',
    href: (v) => v,
  },
  { key: 'twogis_url', icon: 'location_on', color: '#2A6EDD', label: '2GIS', href: (v) => v },
]

export default function StorePublicScreen() {
  const navigate = useNavigate()
  const { lang } = useI18n()
  const { currentStore: store, isStoreLoading, rememberStore } = useStore()
  const [showFullDesc, setShowFullDesc] = useState(false)
  const isKz = lang === 'kz'

  if (isStoreLoading) {
    return (
      <div
        className="app-frame"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            border: '3px solid rgba(56,189,248,0.15)',
            borderTop: '3px solid #38BDF8',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!store) return <Navigate to="/stores" replace />

  const hasContacts = CONTACTS.some((c) => store[c.key])
  const hasDescription = store.description || store.short_description

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <div style={{ padding: '28px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'flex-start',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            arrow_back
          </span>
        </button>

        {/* Store header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          {store.logo_url || store.logo ? (
            <img
              src={store.logo_url || store.logo}
              alt={store.name}
              style={{
                width: 80,
                height: 80,
                borderRadius: 22,
                objectFit: 'cover',
                flexShrink: 0,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}
            />
          ) : (
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 22,
                background: 'linear-gradient(135deg, rgba(56,189,248,0.25), rgba(124,58,237,0.25))',
                border: '1px solid rgba(56,189,248,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                fontWeight: 800,
                color: '#fff',
                fontFamily: 'var(--font-display)',
                flexShrink: 0,
              }}
            >
              {store.name?.[0]?.toUpperCase() || 'K'}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'rgba(167,139,250,0.7)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {isKz ? 'Дүкен беті' : 'Страница магазина'}
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                fontWeight: 900,
                color: '#fff',
                lineHeight: 1.15,
                margin: '0 0 6px',
              }}
            >
              {store.name}
            </h1>
            {(store.city || store.address) && (
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(180,180,210,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  location_on
                </span>
                {[store.city, store.address].filter(Boolean).join(' · ')}
              </div>
            )}
            {store.short_description && (
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(180,180,210,0.7)',
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                {store.short_description}
              </div>
            )}
          </div>
        </div>

        {/* Full description */}
        {hasDescription && (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setShowFullDesc((v) => !v)}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18, color: '#A78BFA' }}
                >
                  description
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {isKz ? 'Магазин туралы' : 'О магазине'}
                </span>
              </div>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 18,
                  color: 'var(--text-dim)',
                  transition: 'transform 0.2s',
                  transform: showFullDesc ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                expand_more
              </span>
            </button>
            {showFullDesc && (
              <div
                style={{
                  padding: '0 16px 16px',
                  fontSize: 14,
                  color: 'rgba(180,180,210,0.8)',
                  lineHeight: 1.65,
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div style={{ paddingTop: 12 }}>{store.description || store.short_description}</div>
              </div>
            )}
          </div>
        )}

        {/* Contacts */}
        {hasContacts && (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: 1,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {isKz ? 'Байланыс' : 'Контакты'}
            </div>
            {CONTACTS.filter((c) => store[c.key]).map((c, i, arr) => (
              <div key={c.key}>
                <a
                  href={c.href(store[c.key])}
                  target={c.key !== 'phone' ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    textDecoration: 'none',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: `${c.color}18`,
                      border: `1px solid ${c.color}35`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 18, color: c.color }}
                    >
                      {c.icon}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>
                      {c.label}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: '#fff',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {store[c.key]}
                    </div>
                  </div>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, color: 'var(--text-dim)' }}
                  >
                    open_in_new
                  </span>
                </a>
                {i < arr.length - 1 && (
                  <div
                    style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 16px' }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Körset features */}
        <div
          style={{
            padding: '16px 18px',
            borderRadius: 18,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            {isKz ? 'Körset осы дүкенде не істей алады' : 'Что умеет Körset в этом магазине'}
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              color: 'rgba(210,210,240,0.7)',
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            <li>{isKz ? 'Штрихкодтарды сканерлеу' : 'Сканирование штрихкодов товаров'}</li>
            <li>
              {isKz
                ? 'Құрам, аллергендер, КБЖУ және fit-check'
                : 'Состав, аллергены, КБЖУ и fit-check'}
            </li>
            <li>
              {isKz ? 'Дүкен контекстіндегі баға мен сөрелер' : 'Цены и полки в контексте магазина'}
            </li>
            <li>{isKz ? 'Тауар бойынша AI сұрақтары' : 'AI-вопросы по товару'}</li>
          </ul>
        </div>

        {/* CTA buttons */}
        <button
          onClick={() => {
            rememberStore(store.slug)
            navigate(`/s/${store.slug}`)
          }}
          style={{
            width: '100%',
            padding: '18px',
            borderRadius: 18,
            cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.22), rgba(109,40,217,0.1))',
            border: '1.5px solid rgba(124,58,237,0.4)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {isKz ? 'Körset-те дүкенді ашу' : 'Открыть магазин в Körset'}
        </button>

        <button
          onClick={() => {
            rememberStore(store.slug)
            navigate(`/s/${store.slug}/scan`)
          }}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 18,
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            color: '#E9D5FF',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {isKz ? 'Сканерлеуге өту' : 'Сразу перейти к сканированию'}
        </button>
      </div>
    </div>
  )
}
