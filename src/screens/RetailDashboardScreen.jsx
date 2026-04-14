import { useI18n } from '../utils/i18n.js'
import { useStore } from '../contexts/StoreContext.jsx'

export default function RetailDashboardScreen() {
  const { t } = useI18n()
  const { currentStore } = useStore()
  
  const d = t.retail.dashboard

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Metrics Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            {d.todayScans}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#fff', marginTop: 4 }}>124</div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
            {d.weekScans}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#fff', marginTop: 4 }}>842</div>
        </div>
      </div>

      {/* Metrics Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
            {d.missedProducts}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#10B981', marginTop: 4 }}>34</div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
            {d.totalProducts}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', color: '#fff', marginTop: 4 }}>1 405</div>
        </div>
      </div>

      {/* Break */}
      <div style={{ height: 16 }}></div>

      {/* Top Products */}
      <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#fff' }}>{d.topProducts}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { name: 'Coca-Cola Zero 0.5л', count: 45, img: 'https://images.openfoodfacts.org/images/products/544/900/021/4911/front_ru.196.200.jpg' },
          { name: 'Lay\'s Сметана и зелень 150г', count: 32, img: 'https://images.openfoodfacts.org/images/products/469/038/800/2823/front_en.16.200.jpg' },
          { name: 'Шоколад Alpen Gold 85г', count: 28, img: null },
          { name: 'Хлеб тостовый Harrys', count: 15, img: null },
          { name: 'Энергетик Red Bull 0.25л', count: 12, img: null }
        ].map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '10px 12px', borderRadius: 12, gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {p.img ? <img src={p.img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 18 }}>📦</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{i + 1} место</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#38BDF8', fontFamily: 'var(--font-display)' }}>
              {p.count} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-sub)' }}>сканов</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
