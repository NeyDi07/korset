import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useUserData } from '../contexts/UserDataContext.jsx'
import { useI18n } from '../utils/i18n.js'
import productsData from '../data/products.json'

const fontAdvent = "'Advent Pro', sans-serif"

export default function HistoryScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, internalUserId } = useAuth()
  const { lang } = useI18n()

  const [history, setHistory] = useState([])
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(searchParams.get('tab') || 'history')

  useEffect(() => {
    if (!user || !internalUserId) {
      if (!user) setLoading(false)
      return
    }

    const loadData = async () => {
      setLoading(true)

      // ── Load History from scan_events ──
      // scan_events uses global_product_id (UUID) and ean columns
      const { data: histData } = await supabase.from('scan_events')
        .select('ean, global_product_id, created_at')
        .eq('user_id', internalUserId)
        .order('created_at', { ascending: false })
        .limit(50)

      // ── Load Favorites ──
      const { data: favData } = await supabase.from('user_favorites')
        .select('global_product_id, ean, created_at')
        .eq('user_id', internalUserId)
        .order('created_at', { ascending: false })

      // ── Resolve history products ──
      const seenEans = new Set()
      const histProducts = []
      for (const h of (histData || [])) {
        const key = h.ean || h.global_product_id
        if (!key || seenEans.has(key)) continue
        seenEans.add(key)

        // Try local JSON first
        let p = productsData.find(x => x.ean === h.ean || x.id === h.global_product_id)

        // If not found locally, try Supabase global_products
        if (!p && h.global_product_id) {
          const { data: gp } = await supabase.from('global_products')
            .select('id, name, brand, ean, category, images_json')
            .eq('id', h.global_product_id).maybeSingle()
          if (gp) {
            const images = typeof gp.images_json === 'string' ? JSON.parse(gp.images_json || '[]') : (gp.images_json || [])
            p = { id: gp.id, name: gp.name, brand: gp.brand, ean: gp.ean, category: gp.category || 'grocery', images }
          }
        }

        // If not found in Supabase, try external_product_cache by EAN
        if (!p && h.ean) {
          const { data: cached } = await supabase.from('external_product_cache')
            .select('product_name, brand, ean, image_url')
            .eq('ean', h.ean).maybeSingle()
          if (cached) {
            p = { id: h.ean, name: cached.product_name, brand: cached.brand, ean: h.ean, category: 'grocery', images: cached.image_url ? [cached.image_url] : [] }
          }
        }

        if (!p) {
          p = { id: h.ean || h.global_product_id, name: h.ean ? `${lang === 'kz' ? 'Тауар' : 'Товар'} ${h.ean}` : (lang === 'kz' ? 'Белгісіз тауар' : 'Неизвестный товар'), category: 'grocery', ean: h.ean }
        }

        histProducts.push({ ...p, scanDate: new Date(h.created_at) })
      }
      setHistory(histProducts)

      // ── Resolve favorite products ──
      const favProducts = []
      for (const f of (favData || [])) {
        const queryId = f.global_product_id || f.ean
        
        let p = productsData.find(x => x.id === queryId || x.ean === f.ean)

        if (!p && f.global_product_id) {
          const { data: gp } = await supabase.from('global_products')
            .select('id, name, brand, ean, category, images_json')
            .eq('id', f.global_product_id).maybeSingle()
          if (gp) {
            const images = typeof gp.images_json === 'string' ? JSON.parse(gp.images_json || '[]') : (gp.images_json || [])
            p = { id: gp.id, name: gp.name, brand: gp.brand, ean: gp.ean, category: gp.category || 'grocery', images }
          }
        }

        if (!p && f.ean) {
          const { data: cached } = await supabase.from('external_product_cache')
            .select('product_name, brand, ean, image_url')
            .eq('ean', f.ean).maybeSingle()
          if (cached) {
            p = { id: f.ean, name: cached.product_name, brand: cached.brand, ean: cached.ean, category: 'grocery', images: cached.image_url ? [cached.image_url] : [] }
          }
        }

        if (!p) p = { id: queryId, name: lang === 'kz' ? 'Белгісіз тауар' : 'Неизвестный товар', category: 'grocery' }

        favProducts.push({ ...p, favDate: f.created_at ? new Date(f.created_at) : null })
      }
      setFavorites(favProducts)

      setLoading(false)
    }

    loadData()
  }, [user, internalUserId])
  const { checkIsFavorite, toggleFavorite } = useUserData()

  // ── Remove from favorites ──
  const removeFavorite = async (p, e) => {
    e.stopPropagation()
    if (!user || !internalUserId || !p.ean) return
    try {
      await toggleFavorite(p)
      // Remove locally from UI list to reflect the action instantly
      setFavorites(prev => prev.filter(f => f.ean !== p.ean))
    } catch(err) {
      // errors handled by context
    }
  }
  if (!user) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 16, left: 16, width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <h2 style={{ fontSize: 20, fontFamily: fontAdvent, color: '#fff', marginBottom: 8 }}>
          {lang === 'kz' ? 'Тарихты көру үшін кіріңіз' : 'Войдите, чтобы видеть историю'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.5, fontFamily: fontAdvent }}>
          {lang === 'kz' ? 'Сканерленген тауарлар мен таңдаулыларды көру үшін аккаунтқа кіріңіз' : 'Войдите, чтобы видеть отсканированные товары и избранное'}
        </p>
        <button onClick={() => navigate('/auth')} style={{ background: '#7C3AED', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: 14, fontSize: 15, fontWeight: 600, fontFamily: fontAdvent, cursor: 'pointer' }}>
          {lang === 'kz' ? 'Аккаунтқа кіру' : 'Войти'}
        </button>
      </div>
    )
  }

  const list = tab === 'history' ? history : favorites

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(12,12,24,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: fontAdvent, color: '#fff' }}>
            {lang === 'kz' ? 'Менің тауарларым' : 'Мои товары'}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 3 }}>
          <button onClick={() => setTab('history')} style={{
            flex: 1, padding: '10px 0', borderRadius: 9, fontSize: 13, fontWeight: 600, fontFamily: fontAdvent,
            border: 'none', background: tab === 'history' ? 'rgba(124,58,237,0.25)' : 'transparent',
            color: tab === 'history' ? '#C4B5FD' : 'var(--text-dim)', cursor: 'pointer', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {lang === 'kz' ? 'Тарих' : 'История'}
            {history.length > 0 && <span style={{ fontSize: 10, background: 'rgba(124,58,237,0.3)', padding: '1px 6px', borderRadius: 8, color: '#C4B5FD' }}>{history.length}</span>}
          </button>
          <button onClick={() => setTab('favorites')} style={{
            flex: 1, padding: '10px 0', borderRadius: 9, fontSize: 13, fontWeight: 600, fontFamily: fontAdvent,
            border: 'none', background: tab === 'favorites' ? 'rgba(239,68,68,0.15)' : 'transparent',
            color: tab === 'favorites' ? '#FCA5A5' : 'var(--text-dim)', cursor: 'pointer', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={tab === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {lang === 'kz' ? 'Таңдаулы' : 'Избранные'}
            {favorites.length > 0 && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.2)', padding: '1px 6px', borderRadius: 8, color: '#FCA5A5' }}>{favorites.length}</span>}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 20px', paddingBottom: 100 }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-dim)', fontFamily: fontAdvent }}>
            <div style={{ width: 32, height: 32, border: '3px solid rgba(124,58,237,0.2)', borderTop: '3px solid #7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            {lang === 'kz' ? 'Жүктелуде...' : 'Загрузка...'}
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 60, color: 'var(--text-dim)' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              {tab === 'history'
                ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78Z"/></svg>
              }
            </div>
            <p style={{ fontFamily: fontAdvent, fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>
              {tab === 'history'
                ? (lang === 'kz' ? 'Сіз әлі ештеңе сканерлемедіңіз' : 'Вы ещё ничего не сканировали')
                : (lang === 'kz' ? 'Сізде таңдаулы тауарлар жоқ' : 'У вас пока нет избранных')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((p, i) => (
              <div key={(p.id || p.ean || i) + '-' + i}
                onClick={() => {
                  // Navigate: local product by id, or external by ean
                  const localP = productsData.find(x => x.id === p.id)
                  if (localP) {
                    navigate(`/product/${p.id}`)
                  } else if (p.ean) {
                    navigate(`/product/ext/${p.ean}`, { state: { product: p } })
                  }
                }}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 16, padding: 12, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer',
                  transition: 'background 0.15s'
                }}>
                {/* Thumb */}
                <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {p.images?.[0] || p.ean ? (
                    <img src={p.images?.[0] || `/products/${p.ean}.png`} alt={p.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }}
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex') }} />
                  ) : null}
                  <span style={{ fontSize: 22, opacity: 0.3, display: p.images?.[0] || p.ean ? 'none' : 'flex' }}>📦</span>
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: fontAdvent, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>{p.name}</div>
                  {p.brand && <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: fontAdvent }}>{p.brand}</div>}
                  {p.scanDate && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 3, fontFamily: fontAdvent }}>{p.scanDate.toLocaleDateString()}</div>}
                </div>
                {/* Remove favorite button */}
                {tab === 'favorites' && (
                  <button onClick={(e) => removeFavorite(p, e)} style={{
                    width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,0.1)',
                    border: 'none', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#F87171" stroke="#F87171" strokeWidth="1"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78Z"/></svg>
                  </button>
                )}
                {/* Arrow for history */}
                {tab === 'history' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
