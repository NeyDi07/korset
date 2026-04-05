import { useNavigate } from 'react-router-dom'
import { getStores } from '../data/stores.js'
import { buildStorePublicPath } from '../utils/routes.js'
import { useStore } from '../contexts/StoreContext.jsx'

export default function StoresScreen() {
  const navigate = useNavigate()
  const { rememberStore } = useStore()
  const stores = getStores()

  return (
    <div className="screen" style={{ paddingBottom: 32 }}>
      <div className="header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ width: 38, height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}>←</button>
        <div className="screen-title" style={{ margin: 0 }}>Магазины</div>
      </div>
      <div style={{ padding: '20px', display: 'grid', gap: 12 }}>
        {stores.map((store) => (
          <button key={store.slug} onClick={() => { rememberStore(store.slug); navigate(`/s/${store.slug}`) }} style={{
            padding: '16px', borderRadius: 18, cursor: 'pointer', textAlign: 'left',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <img src={store.logo} alt={store.name} style={{ width: 52, height: 52, borderRadius: 16, objectFit: 'cover' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{store.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(180,180,210,0.65)' }}>{store.city}</div>
              <div style={{ fontSize: 12, color: 'rgba(200,200,240,0.7)', marginTop: 6, lineHeight: 1.45 }}>{store.description}</div>
            </div>
            <span style={{ color: 'rgba(167,139,250,0.8)', fontSize: 18 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
