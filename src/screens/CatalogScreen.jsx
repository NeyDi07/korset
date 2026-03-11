import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import products from '../data/products.json'
import { checkProductFit, formatPrice, CATEGORY_LABELS } from '../utils/fitCheck.js'
import { loadProfile } from '../utils/profile.js'

const CATEGORY_ORDER = ['grocery', 'electronics', 'diy']
const CATEGORIES = [
  { id: 'grocery',     label: 'Продукты',      icon: 'grocery'  },
  { id: 'electronics', label: 'Электроника',    icon: 'elec'     },
  { id: 'diy',         label: 'Стройматериалы', icon: 'diy'      },
]
const SORT_OPTIONS = [
  { id: 'fit',     label: 'Подходящие' },
  { id: 'cheap',   label: 'Дешевле'   },
  { id: 'pricey',  label: 'Дороже'    },
  { id: 'rating',  label: 'Рейтинг'   },
]

function CatIcon({ name, size = 16, color = 'currentColor' }) {
  const s = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (name === 'grocery') return <svg {...s}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
  if (name === 'elec')    return <svg {...s}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
  if (name === 'diy')     return <svg {...s}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
  return null
}

function ProductThumb({ product }) {
  const [imgOk, setImgOk] = useState(true)
  const src = product.images?.[0]
  if (src && imgOk) {
    return <img src={src} alt={product.name} onError={() => setImgOk(false)}
      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} />
  }
  const colors = {
    grocery:     '#10B981',
    electronics: '#60A5FA',
    diy:         '#FCD34D',
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, fontWeight: 800, color: colors[product.category] || '#A78BFA', fontFamily: 'var(--font-display)' }}>
      {product.name[0]}
    </div>
  )
}

function FitBadge({ fits }) {
  if (fits === null) return null
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 3, flexShrink: 0,
      width: 44, height: 44, borderRadius: 12,
      background: fits ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
      border: `1.5px solid ${fits ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.3)'}`,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke={fits ? '#10B981' : '#F87171'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {fits
          ? <polyline points="20 6 9 17 4 12"/>
          : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
        }
      </svg>
      <span style={{ fontSize: 10, fontWeight: 700, color: fits ? '#10B981' : '#F87171' }}>
        {fits ? 'OK' : 'НЕТ'}
      </span>
    </div>
  )
}

export default function CatalogScreen() {
  const navigate = useNavigate()
  const profile = loadProfile()
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [sort, setSort] = useState('fit')
  const [catOpen, setCatOpen] = useState(false)

  const hasProfile = Boolean(
    profile?.halal || profile?.halalOnly ||
    profile?.allergens?.length || profile?.dietGoals?.length
  )

  const list = useMemo(() => {
    const query = q.trim().toLowerCase()
    let arr = products.slice()

    // Category filter
    if (catFilter !== 'all') arr = arr.filter(p => p.category === catFilter)

    // Search
    if (query) arr = arr.filter(p => `${p.name} ${(p.tags||[]).join(' ')}`.toLowerCase().includes(query))

    // Sort
    arr.sort((a, b) => {
      if (sort === 'cheap')  return a.priceKzt - b.priceKzt
      if (sort === 'pricey') return b.priceKzt - a.priceKzt
      if (sort === 'rating') return (b.qualityScore||0) - (a.qualityScore||0)
      // 'fit' — подходящие сверху, потом по категории, потом по рейтингу
      if (hasProfile) {
        const af = checkProductFit(a, profile).fits ? 0 : 1
        const bf = checkProductFit(b, profile).fits ? 0 : 1
        if (af !== bf) return af - bf
      }
      // Category order
      const ao = CATEGORY_ORDER.indexOf(a.category)
      const bo = CATEGORY_ORDER.indexOf(b.category)
      if (ao !== bo) return ao - bo
      return (b.qualityScore||0) - (a.qualityScore||0)
    })

    return arr
  }, [q, catFilter, sort, hasProfile])

  const fitCount = hasProfile ? products.filter(p => checkProductFit(p, profile).fits).length : 0
  const activeCat = CATEGORIES.find(c => c.id === catFilter)

  return (
    <div className="screen">
      <div className="header">
        <div className="screen-title" style={{ textAlign: 'center' }}>Товары</div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>

        {/* Search */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '10px 14px', marginBottom: 12 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input style={{ background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font-body)', flex: 1 }}
            placeholder="Поиск..." value={q} onChange={e => setQ(e.target.value)} />
          {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none',
            color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>}
        </div>

        {/* Filters row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>

          {/* Sort */}
          {SORT_OPTIONS.map(opt => {
            // Hide 'fit' if no profile
            if (opt.id === 'fit' && !hasProfile) return null
            const active = sort === opt.id
            return (
              <button key={opt.id} onClick={() => setSort(opt.id)} style={{
                flexShrink: 0, padding: '8px 14px', borderRadius: 20, fontSize: 12,
                fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'var(--font-body)',
                borderColor: active ? 'var(--primary-mid)' : 'var(--border)',
                background: active ? 'var(--primary-dim)' : 'var(--card)',
                color: active ? 'var(--primary-bright)' : 'var(--text-sub)',
                whiteSpace: 'nowrap',
              }}>
                {opt.id === 'fit' && `✓ `}{opt.label}
                {opt.id === 'fit' && fitCount > 0 && (
                  <span style={{ marginLeft: 5, fontSize: 10, background: 'rgba(139,92,246,0.2)',
                    padding: '1px 6px', borderRadius: 10 }}>{fitCount}</span>
                )}
              </button>
            )
          })}

          {/* Divider */}
          <div style={{ width: 1, background: 'var(--border)', flexShrink: 0, margin: '4px 0' }} />

          {/* Category dropdown */}
          <button onClick={() => setCatOpen(o => !o)} style={{
            flexShrink: 0, padding: '8px 14px', borderRadius: 20, fontSize: 12,
            fontWeight: 600, cursor: 'pointer', border: '1.5px solid', fontFamily: 'var(--font-body)',
            display: 'flex', alignItems: 'center', gap: 6,
            borderColor: activeCat ? 'var(--primary-mid)' : 'var(--border)',
            background: activeCat ? 'var(--primary-dim)' : 'var(--card)',
            color: activeCat ? 'var(--primary-bright)' : 'var(--text-sub)',
            whiteSpace: 'nowrap',
          }}>
            {activeCat ? activeCat.label : 'Категория'}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: catOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        </div>

        {/* Category dropdown */}
        {catOpen && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
            <button onClick={() => { setCatFilter('all'); setCatOpen(false) }}
              style={{ width: '100%', padding: '12px 16px', background: catFilter==='all' ? 'var(--primary-dim)' : 'transparent',
                border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-body)',
                color: catFilter==='all' ? 'var(--primary-bright)' : 'var(--text)', fontSize: 14 }}>
              <span style={{ fontSize: 16 }}>🗂</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 600 }}>Все категории</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{products.length} товаров</div>
              </div>
              {catFilter==='all' && <span style={{ color: 'var(--primary-bright)' }}>✓</span>}
            </button>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => { setCatFilter(cat.id); setCatOpen(false) }}
                style={{ width: '100%', padding: '12px 16px',
                  background: catFilter===cat.id ? 'var(--primary-dim)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-body)',
                  color: catFilter===cat.id ? 'var(--primary-bright)' : 'var(--text)', fontSize: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10,
                  background: catFilter===cat.id ? 'rgba(139,92,246,0.2)' : 'var(--surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: catFilter===cat.id ? 'var(--primary-bright)' : 'var(--text-dim)' }}>
                  <CatIcon name={cat.icon} size={16} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>{cat.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
                    {products.filter(p => p.category === cat.id).length} товаров
                  </div>
                </div>
                {catFilter===cat.id && <span style={{ color: 'var(--primary-bright)' }}>✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Results count */}
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10, paddingLeft: 2 }}>
          {list.length} {list.length === 1 ? 'товар' : list.length < 5 ? 'товара' : 'товаров'}
          {activeCat ? ` · ${activeCat.label}` : ''}
        </div>

        {/* Product list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map((product, i) => {
            const fitResult = hasProfile ? checkProductFit(product, profile) : null
            const fits = fitResult?.fits ?? null
            return (
              <div key={product.id} onClick={() => navigate(`/product/${product.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  background: 'var(--card)',
                  border: `1px solid ${fits===true ? 'rgba(16,185,129,0.2)' : fits===false ? 'rgba(239,68,68,0.12)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {/* Thumbnail */}
                <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 12,
                  overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <ProductThumb product={product} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                    {product.name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--primary-bright)' }}>
                      {formatPrice(product.priceKzt)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      padding: '1px 7px', borderRadius: 20 }}>
                      {product.shelf}
                    </span>
                  </div>
                  {/* Fit reason */}
                  {fitResult && !fitResult.fits && fitResult.reasons[0] && (
                    <div style={{ fontSize: 11, color: '#F87171', marginTop: 4, opacity: 0.85 }}>
                      {fitResult.reasons[0].text}
                    </div>
                  )}
                </div>

                {/* Fit badge */}
                <FitBadge fits={fits} />
              </div>
            )
          })}
          {list.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
              <p style={{ fontSize: 14 }}>Ничего не найдено</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
