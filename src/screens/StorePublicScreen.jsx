import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { getStoreBySlug } from '../data/stores.js'
import { useStore } from '../contexts/StoreContext.jsx'

export default function StorePublicScreen() {
  const { storeSlug } = useParams()
  const navigate = useNavigate()
  const { rememberStore } = useStore()
  const store = getStoreBySlug(storeSlug)

  if (!store) return <Navigate to="/stores" replace />

  return (
    <div className="screen" style={{ paddingBottom: 32 }}>
      <div style={{ padding: '28px 24px 0' }}>
        <button onClick={() => navigate('/stores')} style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', marginBottom: 18 }}>←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <img src={store.logo} alt={store.name} style={{ width: 72, height: 72, borderRadius: 22, objectFit: 'cover' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(167,139,250,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Store page</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1.1, margin: 0 }}>{store.name}</h1>
            <div style={{ fontSize: 13, color: 'rgba(180,180,210,0.68)', marginTop: 8 }}>{store.city} · {store.address}</div>
          </div>
        </div>

        <div style={{ padding: '16px 18px', borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Что умеет Körset в этом магазине</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(210,210,240,0.78)', fontSize: 13, lineHeight: 1.7 }}>
            <li>Сканирование штрихкодов товаров</li>
            <li>Состав, аллергены, КБЖУ и fit-check</li>
            <li>Цены и полки в контексте магазина</li>
            <li>AI-вопросы по товару</li>
          </ul>
        </div>

        <button onClick={() => { rememberStore(store.slug); navigate(`/s/${store.slug}`) }} style={{ width: '100%', padding: '18px', borderRadius: 18, cursor: 'pointer', background: 'linear-gradient(135deg, rgba(124,58,237,0.22), rgba(109,40,217,0.1))', border: '1.5px solid rgba(124,58,237,0.4)', color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
          Открыть магазин в Körset
        </button>

        <button onClick={() => { rememberStore(store.slug); navigate(`/s/${store.slug}/scan`) }} style={{ width: '100%', padding: '16px', borderRadius: 18, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#E9D5FF', fontSize: 14, fontWeight: 600 }}>
          Сразу перейти к сканированию
        </button>
      </div>
    </div>
  )
}
