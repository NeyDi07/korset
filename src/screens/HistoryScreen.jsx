import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useI18n } from '../utils/i18n.js'
import productsData from '../data/products.json'

export default function HistoryScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang } = useI18n()
  
  const [history, setHistory] = useState([])
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('history') // history | favorites

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      setLoading(true)
      
      // Load History
      const { data: histData } = await supabase.from('scan_events')
        .select('product_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      // Load Favorites
      const { data: favData } = await supabase.from('user_favorites')
        .select('product_id')
        .eq('user_id', user.id)
      
      // Deduplicate history products (keep most recent)
      const seen = new Set()
      const uniqueHistory = (histData || []).filter(h => {
        if (seen.has(h.product_id)) return false
        seen.add(h.product_id)
        return true
      })

      // Map to full products
      setHistory(uniqueHistory.map(h => {
        const p = productsData.find(x => x.id === h.product_id) || { id: h.product_id, name: 'Неизвестный товар', category: 'grocery' }
        return { ...p, scanDate: new Date(h.created_at) }
      }))

      setFavorites((favData || []).map(f => {
        return productsData.find(x => x.id === f.product_id) || { id: f.product_id, name: 'Неизвестный товар', category: 'grocery' }
      }))

      setLoading(false)
    }

    loadData()
  }, [user])

  if (!user) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: 16, left: 16, width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
        <h2 style={{ fontSize: 20, fontFamily: 'var(--font-display)', color: '#fff', marginBottom: 8 }}>
          {lang === 'kz' ? 'Тарихты көру үшін кіріңіз' : 'Войдите чтобы দেখতে историю'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.5 }}>
          {lang === 'kz' ? 'Сканерленген тауарлар мен таңдаулыларды көру үшін аккаунтқа кіріңіз' : 'Войдите в аккаунт, чтобы сохранять отсканированные товары и добавлять их в избранное.'}
        </p>
        <button onClick={() => navigate('/auth')} style={{ background: '#7C3AED', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}>
          {lang === 'kz' ? 'Аккаунтқа кіру' : 'Войти в аккаунт'}
        </button>
      </div>
    )
  }

  const list = tab === 'history' ? history : favorites

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(12,12,24,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => navigate(-1)} style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', color: '#fff' }}>
            {lang === 'kz' ? 'Менің тауарларым' : 'Мои товары'}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 }}>
          <button onClick={() => setTab('history')} style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', background: tab === 'history' ? 'rgba(124,58,237,0.3)' : 'transparent', color: tab === 'history' ? '#fff' : 'var(--text-dim)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            {lang === 'kz' ? 'Тарих' : 'История'}
          </button>
          <button onClick={() => setTab('favorites')} style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', background: tab === 'favorites' ? 'rgba(239,68,68,0.2)' : 'transparent', color: tab === 'favorites' ? '#FCA5A5' : 'var(--text-dim)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={tab === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            {lang === 'kz' ? 'Тандаулы' : 'Избранное'}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 20px', paddingBottom: 100 }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-dim)' }}>{lang === 'kz' ? 'Жүктелуде...' : 'Загрузка...'}</div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 60, color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 36, opacity: 0.5, marginBottom: 12 }}>{tab === 'history' ? '🕒' : '💔'}</div>
            <p>{tab === 'history' ? (lang === 'kz' ? 'Сіз әлі ештеңе сканерлемедіңіз' : 'Вы еще ничего не сканировали') : (lang === 'kz' ? 'Сізде таңдаулы тауарлар жоқ' : 'У вас пока нет избранных товаров')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map((p, i) => (
              <div key={p.id + i} onClick={() => navigate(`/product/${p.id}`)} style={{
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '12px', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer'
              }}>
                {/* Thumb */}
                <div style={{ width: 60, height: 60, borderRadius: 12, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {p.images?.[0] || p.ean ? (
                    <img src={p.images?.[0] || `/products/${p.ean}.png`} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} onError={(e) => e.target.style.display = 'none'} />
                  ) : <span style={{ fontSize: 24, opacity: 0.3 }}>📦</span>}
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{p.brand}</div>
                  {p.scanDate && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{p.scanDate.toLocaleDateString()}</div>}
                </div>
                {/* Price tag */}
                {p.priceKzt && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-bright)', fontFamily: 'var(--font-display)', padding: '4px 8px', background: 'rgba(124,58,237,0.1)', borderRadius: 8 }}>
                    {p.priceKzt}₸
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
