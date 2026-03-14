import { useNavigate } from 'react-router-dom'
import { loadProfile } from '../utils/profile.js'

export default function HomeScreen() {
  const navigate = useNavigate()
  const profile  = loadProfile()
  const name     = profile?.name

  return (
    <div className="screen" style={{ paddingBottom: 100 }}>
      {/* Hero */}
      <div style={{ padding: '52px 24px 32px' }}>
        <div style={{ fontSize: 13, color: 'rgba(167,139,250,0.8)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.3px' }}>
          {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 900,
          color: '#fff', lineHeight: 1.15, letterSpacing: '-0.5px', marginBottom: 10,
        }}>
          {name ? `Привет, ${name} 👋` : 'Добро пожаловать'}
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(180,180,210,0.75)', lineHeight: 1.55 }}>
          Сканируй товары и узнай — подходят ли они именно тебе
        </p>
      </div>

      {/* Главная кнопка — сканировать */}
      <div style={{ padding: '0 20px 24px' }}>
        <button onClick={() => navigate('/scan')} style={{
          width: '100%', padding: '28px 24px', borderRadius: 24, cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(109,40,217,0.12))',
          border: '1.5px solid rgba(124,58,237,0.4)',
          display: 'flex', alignItems: 'center', gap: 20,
          boxShadow: '0 8px 32px rgba(124,58,237,0.15)',
          transition: 'transform 0.15s ease',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18, flexShrink: 0,
            background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(124,58,237,0.5)',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M3 7V4a1 1 0 0 1 1-1h3"/>
              <path d="M17 3h3a1 1 0 0 1 1 1v3"/>
              <path d="M21 17v3a1 1 0 0 1-1 1h-3"/>
              <path d="M7 21H4a1 1 0 0 1-1-1v-3"/>
              <line x1="7" y1="12" x2="17" y2="12" strokeWidth="2.5"/>
            </svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#E9D5FF', marginBottom: 4 }}>
              Сканировать штрихкод
            </div>
            <div style={{ fontSize: 13, color: 'rgba(167,139,250,0.65)' }}>
              Наведи на любой товар в магазине
            </div>
          </div>
        </button>
      </div>

      {/* Быстрые действия */}
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(160,160,200,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
          Быстрые действия
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { icon: '📦', label: 'Каталог', sub: 'Все товары', path: '/catalog', color: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.2)' },
            { icon: '✦', label: 'AI помощник', sub: 'Спроси про товары', path: '/ai', color: 'rgba(124,58,237,0.15)', border: 'rgba(124,58,237,0.3)' },
          ].map(item => (
            <button key={item.label} onClick={() => navigate(item.path)} style={{
              padding: '16px', borderRadius: 18, cursor: 'pointer',
              background: item.color, border: `1px solid ${item.border}`,
              textAlign: 'left', transition: 'transform 0.15s',
            }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{item.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(200,200,240,0.5)', marginTop: 2 }}>{item.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Возможности */}
      <div style={{ padding: '0 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(160,160,200,0.5)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
          Как это работает
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { n: '1', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', text: 'Сканируй штрихкод любого товара в магазине' },
            { n: '2', color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  text: 'Körset найдёт состав, аллергены и КБЖУ' },
            { n: '3', color: '#34D399', bg: 'rgba(52,211,153,0.12)',  text: 'AI мгновенно проверит — подходит ли товар тебе' },
          ].map(s => (
            <div key={s.n} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: 16,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, color: s.color,
              }}>{s.n}</div>
              <p style={{ fontSize: 13, color: 'rgba(200,200,240,0.8)', lineHeight: 1.5, margin: 0 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
