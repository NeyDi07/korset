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
  if (pre >= '200' && pre <= '299') return false
  if (clean.length === 12) {
    const sum = clean.split('').reduce((s, d, i) => s + parseInt(d) * (i % 2 === 0 ? 1 : 3), 0)
    return true
  }
  if (clean.length !== 13) return false
  const sum = clean
    .slice(0, 12)
    .split('')
    .reduce((s, d, i) => s + parseInt(d) * (i % 2 === 0 ? 1 : 3), 0)
  const check = (10 - (sum % 10)) % 10
  return parseInt(clean[12]) === check
}

export default function EanRecoveryScreen() {
  const { t: _t } = useI18n()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editEan, setEditEan] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

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
    setLoading(false)
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const handleSaveEan = async (product) => {
    const code = editEan.trim()
    if (!code) return
    if (!isValidEan(code)) {
      setError('Невалидный штрихкод — проверьте цифры')
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
        setError('Этот штрихкод уже есть в базе — дубль')
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

    setProducts((prev) => prev.filter((p) => p.id !== product.id))
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
    setProducts((prev) => prev.filter((p) => p.id !== product.id))
    setSaving(null)
  }

  const filtered = products.filter((p) => {
    if (filter === 'branded' && (!p.brand || p.brand.length <= 1)) return false
    if (filter === 'nobrand' && p.brand && p.brand.length > 1) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.ean || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const resolved = 154 - products.length

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
          <span
            className="material-symbols-outlined"
            style={{ color: 'var(--retail-accent)', fontSize: 24 }}
          >
            qr_code_scanner
          </span>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            EAN Recovery
          </h1>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--success-bright)',
              background: 'var(--success-dim)',
              padding: '3px 10px',
              borderRadius: 20,
            }}
          >
            {resolved}/154 resolved
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 12 }}>
          Products without scannable barcode. Scan in-store → paste EAN below.
        </div>

        <input
          type="text"
          placeholder="Search by name or brand..."
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
          }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {[
            { id: 'all', label: `All (${products.length})` },
            { id: 'branded', label: 'Branded' },
            { id: 'nobrand', label: 'No brand' },
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
            background: 'var(--success-dim)',
            border: '1px solid var(--success)',
            color: 'var(--success-bright)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Saved: {success}
        </div>
      )}

      {error && (
        <div
          style={{
            margin: '12px 16px',
            padding: '10px 16px',
            borderRadius: 12,
            background: 'var(--error-dim)',
            border: '1px solid var(--error)',
            color: 'var(--error-bright)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
          {products.length === 0 ? 'All products have real EANs!' : 'No matches'}
        </div>
      ) : (
        <div style={{ padding: '8px 12px' }}>
          {filtered.map((p) => (
            <div
              key={p.id}
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
                  {p.image_url ? (
                    <img
                      src={getImageUrl(p.image_url)}
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
                    {p.name || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
                    {p.brand || <span style={{ color: 'var(--text-disabled)' }}>no brand</span>}
                    <span style={{ color: 'var(--text-disabled)', marginLeft: 8 }}>
                      {p.source_primary}
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
                    {p.ean}
                  </div>
                </div>

                <button
                  onClick={() => handleDeactivate(p)}
                  disabled={saving === p.id}
                  title="Remove (no barcode possible)"
                  style={{
                    background: 'var(--error-dim)',
                    border: '1px solid var(--error)',
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
                    style={{ fontSize: 18, color: 'var(--error-bright)' }}
                  >
                    delete
                  </span>
                </button>
              </div>

              {editingId === p.id ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input
                    type="text"
                    placeholder="Paste real EAN-13 here..."
                    value={editEan}
                    onChange={(e) => setEditEan(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEan(p)
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
                    onClick={() => handleSaveEan(p)}
                    disabled={saving === p.id || !editEan.trim()}
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
                    }}
                  >
                    {saving === p.id ? '...' : 'Save'}
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
                    }}
                  >
                    X
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingId(p.id)
                    setEditEan('')
                    setError(null)
                  }}
                  style={{
                    marginTop: 8,
                    width: '100%',
                    padding: '8px 0',
                    fontSize: 13,
                    fontWeight: 600,
                    background: 'var(--accent-sky-dim)',
                    color: 'var(--accent-sky)',
                    border: '1px solid var(--accent-sky-border)',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, verticalAlign: -3, marginRight: 4 }}
                  >
                    edit
                  </span>
                  Add Barcode
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
