import { useNavigate } from 'react-router-dom'
import { useI18n } from '../utils/i18n.js'
import { useStore } from '../contexts/StoreContext.jsx'
import { getStores } from '../data/stores.js'
import { buildStorePublicPath } from '../utils/routes.js'

export default function HomeScreen() {
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { currentStore, isStoreApp, rememberStore, routes } = useStore()

  if (isStoreApp && currentStore && routes) {
    return (
      <div className="screen" style={{ paddingBottom: 100 }}>
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <img src={currentStore.logo} alt={currentStore.name} style={{ width: 56, height: 56, borderRadius: 18, objectFit: 'cover', background: 'rgba(255,255,255,0.05)' }} />
            <div>
              <div style={{ fontSize: 12, color: 'rgba(167,139,250,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Körset Store Mode
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.1, margin: 0 }}>
                {currentStore.name}
              </h1>
              <div style={{ fontSize: 13, color: 'rgba(180,180,210,0.65)', marginTop: 6 }}>
                {currentStore.city} · {currentStore.address}
              </div>
            </div>
          </div>

          <div style={{ padding: '16px 18px', borderRadius: 18, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.28)', marginBottom: 18 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#E9D5FF', marginBottom: 6 }}>Проверяйте товар в контексте магазина</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(220,220,255,0.75)' }}>
              Состав, аллергены, халал, КБЖУ, цена и полка будут показаны в логике именно этого магазина.
            </div>
          </div>

          <button onClick={() => navigate(routes.scan)} style={{
            width: '100%', padding: '24px 20px', borderRadius: 22, cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.22), rgba(109,40,217,0.1))',
            border: '1.5px solid rgba(124,58,237,0.4)',
            display: 'flex', alignItems: 'center', gap: 18,
            boxShadow: '0 8px 32px rgba(124,58,237,0.12)', marginBottom: 14,
          }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M3 7V4a1 1 0 0 1 1-1h3"/><path d="M17 3h3a1 1 0 0 1 1 1v3"/><path d="M21 17v3a1 1 0 0 1-1 1h-3"/><path d="M7 21H4a1 1 0 0 1-1-1v-3"/><line x1="7" y1="12" x2="17" y2="12" strokeWidth="2.5"/></svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#E9D5FF', marginBottom: 3 }}>{t.home.scanBtn}</div>
              <div style={{ fontSize: 12, color: 'rgba(167,139,250,0.6)' }}>{t.home.scanSub}</div>
            </div>
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <QuickCard title={t.home.catalog} sub={t.home.catalogSub} color="rgba(96,165,250,0.08)" border="rgba(96,165,250,0.18)" onClick={() => navigate(routes.catalog)} />
            <QuickCard title={t.home.ai} sub={t.home.aiSub} color="rgba(124,58,237,0.1)" border="rgba(124,58,237,0.25)" onClick={() => navigate(routes.ai)} />
          </div>

          <button onClick={() => navigate(routes.history)} style={{
            width: '100%', padding: '16px', borderRadius: 18, cursor: 'pointer',
            background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)',
            display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🕘</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)' }}>
                {lang === 'kz' ? 'Менің тарихым' : 'Моя история'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(52,211,153,0.6)', marginTop: 2 }}>
                {lang === 'kz' ? 'Сканерленген тауарлар' : 'Отсканированные товары'}
              </div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  const stores = getStores()
  const continueStore = currentStore && !isStoreApp ? currentStore : null

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <div style={{ padding: '24px 24px 0' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: 'rgba(167,139,250,0.7)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Körset
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1.12, marginBottom: 10 }}>
            AI-ассистент для покупок в офлайн-магазине
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(180,180,210,0.7)', lineHeight: 1.65 }}>
            Сканируйте товар, проверяйте состав, аллергены, халал, КБЖУ и сравнивайте альтернативы в контексте конкретного магазина.
          </p>
        </div>

        <button onClick={() => navigate('/stores')} style={{
          width: '100%', padding: '18px 18px', borderRadius: 18, cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.22), rgba(109,40,217,0.1))',
          border: '1.5px solid rgba(124,58,237,0.4)', color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 12,
        }}>
          Выбрать магазин
        </button>

        {continueStore ? (
          <button onClick={() => navigate(`/s/${continueStore.slug}`)} style={{
            width: '100%', padding: '16px 18px', borderRadius: 18, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#E9D5FF', fontSize: 14, fontWeight: 600, marginBottom: 18,
          }}>
            Продолжить в магазине: {continueStore.name}
          </button>
        ) : null}

        <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
          {stores.map((store) => (
            <button key={store.slug} onClick={() => { rememberStore(store.slug); navigate(buildStorePublicPath(store.slug)) }} style={{
              padding: '14px 16px', borderRadius: 18, cursor: 'pointer', textAlign: 'left',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <img src={store.logo} alt={store.name} style={{ width: 44, height: 44, borderRadius: 14, objectFit: 'cover' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{store.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(180,180,210,0.65)' }}>{store.city}</div>
              </div>
              <span style={{ color: 'rgba(167,139,250,0.8)', fontSize: 18 }}>›</span>
            </button>
          ))}
        </div>

        <div style={{ padding: '16px 18px', borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Как это будет работать в будущем</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(200,200,240,0.72)' }}>
            Основной сценарий Körset это вход через QR-код магазина. Общий сайт нужен для поиска магазина, выбора точки и публичной страницы каждой локации.
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickCard({ title, sub, color, border, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '16px', borderRadius: 18, cursor: 'pointer', background: color, border: `1px solid ${border}`, textAlign: 'left' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)' }}>{title}</div>
      <div style={{ fontSize: 11, color: 'rgba(167,139,250,0.6)', marginTop: 4 }}>{sub}</div>
    </button>
  )
}
