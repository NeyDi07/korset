import { useState, useCallback, useEffect } from 'react'
import { useI18n } from '../utils/i18n.js'
import { supabase } from '../utils/supabase.js'
import { getImageUrl } from '../utils/imageUrl.js'

const PAGE_SIZE = 50

function isValidEan(code) {
  if (!code || typeof code !== 'string') return false
  const clean = code.replace(/\s/g, '')
  if (!/^\d+$/.test(clean)) return false
  const pre = clean.substring(0, 3)
  if (pre >= '020' && pre <= '029') return false
  if (pre >= '040' && pre <= '049') return false
  if (clean.length === 12) return true
  if (clean.length !== 13) return false
  const sum = clean
    .slice(0, 12)
    .split('')
    .reduce((s, d, i) => s + parseInt(d) * (i % 2 === 0 ? 1 : 3), 0)
  const check = (10 - (sum % 10)) % 10
  return parseInt(clean[12]) === check
}

export default function EanRecoveryScreen() {
  const { t } = useI18n()
  const p = t.retail.products
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editEan, setEditEan] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [initialTotal, setInitialTotal] = useState(0)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    const all = []
    for (let page = 0; page < 20; page++) {
      const { data, error } = await supabase
        .from('global_products')
        .select(
          'id, ean, name, name_kz, brand, category, image_url, ingredients_raw, source_primary'
        )
        .eq('is_active', true)
        .or('ean.like.arbuz_%,ean.like.kaspi_%,ean.like.korzinavdom_%')
        .order('brand')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < PAGE_SIZE) break
    }
    setProducts(all)
    setInitialTotal(all.length)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const handleSaveEan = async (product) => {
    const code = editEan.trim()
    if (!code) return
    if (!isValidEan(code)) {
      setError(p.invalidEan)
      return
    }

    setSaving(product.id)
    setError(null)

    const { error: dbError } = await supabase
      .from('global_products')
      .update({ ean: code })
      .eq('id', product.id)

    if (dbError) {
      if (dbError.message.includes('duplicate key')) {
        setError(p.duplicateEan)
      } else {
        setError(dbError.message)
      }
      setSaving(null)
      return
    }

    const { error: _spError } = await supabase
      .from('store_products')
      .update({ ean: code })
      .eq('global_product_id', product.id)
      .eq('is_active', true)

    if (_spError) console.log('store_products ean update:', _spError.message)

    setProducts((prev) => prev.filter((pr) => pr.id !== product.id))
    setEditingId(null)
    setEditEan('')
    setSaving(null)
    setSuccess(product.brand + ' ' + (product.name || '').substring(0, 25))
    setTimeout(() => setSuccess(null), 2500)
  }

  const handleDeactivate = async (product) => {
    setSaving(product.id)
    await supabase.from('global_products').update({ is_active: false }).eq('id', product.id)
    await supabase
      .from('store_products')
      .update({ is_active: false })
      .eq('global_product_id', product.id)
      .eq('is_active', true)
    setProducts((prev) => prev.filter((pr) => pr.id !== product.id))
    setSaving(null)
  }

  const filtered = products.filter((pr) => {
    if (filter === 'branded' && (!pr.brand || pr.brand.length <= 1)) return false
    if (filter === 'nobrand' && pr.brand && pr.brand.length > 1) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        (pr.name || '').toLowerCase().includes(q) ||
        (pr.brand || '').toLowerCase().includes(q) ||
        (pr.ean || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const resolved = initialTotal - products.length

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--retail-bg)', paddingBottom: 90 }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--retail-header-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--retail-border)',
          padding: '16px 16px 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span className="material-symbols-outlined" style={{ color: '#FB923C', fontSize: 24 }}>
            qr_code_scanner
          </span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {p.eanRecovery}
          </h1>
          {products.length === 0 && !loading ? (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                fontWeight: 600,
                color: '#10B981',
                background: 'rgba(16,185,129,0.12)',
                padding: '3px 10px',
                borderRadius: 20,
              }}
            >
              Все решены
            </span>
          ) : (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                fontWeight: 600,
                color: '#FB923C',
                background: 'rgba(251,146,60,0.12)',
                padding: '3px 10px',
                borderRadius: 20,
              }}
            >
              {products.length} без штрихкода
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 12 }}>
          {p.eanRecoveryDesc}
          {resolved > 0 && (
            <span style={{ color: '#10B981', marginLeft: 8 }}>Решено: {resolved}</span>
          )}
        </div>

        <input
          type="text"
          placeholder="Поиск по названию или бренду..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            fontSize: 14,
            background: 'var(--input-bg)',
            color: 'var(--text)',
            border: '1px solid var(--input-border)',
            borderRadius: 12,
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'var(--font-body)',
          }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {[
            { id: 'all', label: `Все (${products.length})` },
            { id: 'branded', label: 'С брендом' },
            { id: 'nobrand', label: 'Без бренда' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                background: filter === f.id ? 'var(--retail-accent)' : 'var(--glass-bg)',
                color: filter === f.id ? '#fff' : 'var(--text-sub)',
                outline: filter === f.id ? 'none' : '1px solid var(--glass-border)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {success && (
        <div
          style={{
            margin: '12px 16px',
            padding: '10px 16px',
            borderRadius: 12,
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            color: '#10B981',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Сохранено: {success}
        </div>
      )}

      {error && (
        <div
          style={{
            margin: '12px 16px',
            padding: '10px 16px',
            borderRadius: 12,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#F87171',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
          Загрузка...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
          {products.length === 0 ? 'У всех товаров есть штрихкод!' : 'Ничего не найдено'}
        </div>
      ) : (
        <div style={{ padding: '8px 12px' }}>
          {filtered.map((pr) => (
            <div
              key={pr.id}
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-soft-border)',
                borderRadius: 16,
                padding: 14,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', gap: 12 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: 'var(--image-bg)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {pr.image_url ? (
                    <img
                      src={getImageUrl(pr.image_url)}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 22, color: 'var(--text-disabled)' }}
                    >
                      image_not_supported
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text)',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pr.name || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
                    {pr.brand || <span style={{ color: 'var(--text-disabled)' }}>без бренда</span>}
                    <span style={{ color: 'var(--text-disabled)', marginLeft: 8 }}>
                      {pr.source_primary}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-disabled)',
                      marginTop: 2,
                      fontFamily: 'monospace',
                    }}
                  >
                    {pr.ean}
                  </div>
                </div>

                <button
                  onClick={() => handleDeactivate(pr)}
                  disabled={saving === pr.id}
                  title="Удалить (штрихкод невозможен)"
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: 10,
                    width: 34,
                    height: 34,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 18, color: '#F87171' }}
                  >
                    delete
                  </span>
                </button>
              </div>

              {editingId === pr.id ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input
                    type="text"
                    placeholder="Вставь EAN-13 штрихкод..."
                    value={editEan}
                    onChange={(e) => setEditEan(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEan(pr)
                    }}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      fontSize: 15,
                      fontFamily: 'monospace',
                      background: 'var(--input-bg)',
                      color: 'var(--text)',
                      border: '2px solid var(--retail-accent)',
                      borderRadius: 12,
                      outline: 'none',
                      letterSpacing: 1,
                    }}
                  />
                  <button
                    onClick={() => handleSaveEan(pr)}
                    disabled={saving === pr.id || !editEan.trim()}
                    style={{
                      padding: '10px 18px',
                      fontSize: 13,
                      fontWeight: 700,
                      background: 'var(--retail-accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 12,
                      cursor: 'pointer',
                      opacity: !editEan.trim() ? 0.5 : 1,
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {saving === pr.id ? '...' : p.saveBarcode}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null)
                      setEditEan('')
                      setError(null)
                    }}
                    style={{
                      padding: '10px 14px',
                      fontSize: 13,
                      background: 'var(--glass-bg)',
                      color: 'var(--text-sub)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 12,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    X
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingId(pr.id)
                    setEditEan('')
                    setError(null)
                  }}
                  style={{
                    marginTop: 8,
                    width: '100%',
                    padding: '8px 0',
                    fontSize: 13,
                    fontWeight: 600,
                    background: 'rgba(56,189,248,0.08)',
                    color: '#38BDF8',
                    border: '1px solid rgba(56,189,248,0.2)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, verticalAlign: -3, marginRight: 4 }}
                  >
                    edit
                  </span>
                  {p.addBarcode}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
