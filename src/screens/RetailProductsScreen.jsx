import { useState, useMemo } from 'react'
import { useI18n } from '../utils/i18n.js'

const MOCK_PRODUCTS = [
  { id: '1', ean: '5449000214911', name: 'Coca-Cola Zero 0.5л', brand: 'Coca-Cola', price: 450, inStock: true, image: 'https://images.openfoodfacts.org/images/products/544/900/021/4911/front_ru.196.200.jpg' },
  { id: '2', ean: '4690388002823', name: 'Lay\'s Сметана/зелень 150г', brand: 'Lay\'s', price: 950, inStock: true, image: 'https://images.openfoodfacts.org/images/products/469/038/800/2823/front_en.16.200.jpg' },
  { id: '3', ean: '7622210833731', name: 'Шоколад Alpen Gold 85г', brand: 'Alpen Gold', price: 380, inStock: false, image: null },
  { id: '4', ean: '9002490100070', name: 'Red Bull 0.25л', brand: 'Red Bull', price: 750, inStock: true, image: null },
  { id: '5', ean: '4601662002361', name: 'Сок J7 Яблоко 0.97л', brand: 'J7', price: 820, inStock: true, image: null },
  { id: '6', ean: '4601662002362', name: 'Сок Добрый Апельсин 1л', brand: 'Добрый', price: 650, inStock: false, image: null },
  { id: '7', ean: '4601662033333', name: 'Хлеб Тостовый Harrys', brand: 'Harrys', price: 550, inStock: true, image: null },
]

export default function RetailProductsScreen() {
  const { lang, t } = useI18n()
  
  const [products, setProducts] = useState(MOCK_PRODUCTS)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(p => p.name.toLowerCase().includes(q) || p.ean.includes(q))
  }, [products, search])

  const handlePriceChange = (id, newPrice) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, price: Number(newPrice) || 0 } : p))
  }

  const toggleStock = (id) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, inStock: !p.inStock } : p))
  }

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Sticky Top Bar & Search */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(8,12,24,0.95)', backdropFilter: 'blur(20px)',
        padding: '16px 20px', borderBottom: '1px solid rgba(56, 189, 248, 0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '10px 16px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input 
            type="text" 
            placeholder={lang === 'kz' ? 'Тауарды іздеу (атауы, EAN)' : 'Поиск товара (название, штрихкод)'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              flex: 1, background: 'transparent', border: 'none', color: '#fff', 
              fontSize: 15, outline: 'none', marginLeft: 10, fontFamily: 'var(--font-body)' 
            }}
          />
          {search && (
            <svg onClick={() => setSearch('')} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          )}
        </div>
      </div>

      {/* Product List */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredProducts.length === 0 ? (
           <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--text-dim)' }}>
             Ничего не найдено
           </div>
        ) : filteredProducts.map(product => {
          const isExpanded = expandedId === product.id
          
          return (
            <div key={product.id} style={{
              background: isExpanded ? 'rgba(56, 189, 248, 0.05)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${isExpanded ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
              borderRadius: 18,
              transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              overflow: 'hidden'
            }}>
              
              {/* Header (Always visible) */}
              <div 
                onClick={() => toggleExpand(product.id)}
                style={{
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'
                }}
              >
                {/* Image Placeholder */}
                <div style={{ 
                  width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.05)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  opacity: product.inStock ? 1 : 0.4
                }}>
                  {product.image ? (
                    <img src={product.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                  ) : (
                    <span style={{ fontSize: 20 }}>📦</span>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0, opacity: product.inStock ? 1 : 0.5 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {product.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
                    {product.brand}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>
                    {product.ean}
                  </div>
                </div>

                {/* Status/Price Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <div style={{ 
                    fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)', 
                    color: product.inStock ? '#38BDF8' : 'var(--text-dim)', 
                    textDecoration: product.inStock ? 'none' : 'line-through'
                  }}>
                    {product.price} ₸
                  </div>
                  <div style={{ 
                    fontSize: 10, fontWeight: 600, marginTop: 4, padding: '2px 6px', borderRadius: 6,
                    background: product.inStock ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: product.inStock ? '#10B981' : '#EF4444'
                  }}>
                    {product.inStock ? (lang === 'kz' ? 'Бар' : 'В наличии') : (lang === 'kz' ? 'Жоқ' : 'Нет')}
                  </div>
                </div>
              </div>

              {/* Collapsible Editor panel */}
              <div style={{
                maxHeight: isExpanded ? 300 : 0,
                opacity: isExpanded ? 1 : 0,
                transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                background: 'rgba(0,0,0,0.2)',
                borderTop: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none'
              }}>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* Price Editor */}
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-sub)', marginBottom: 8, display: 'block', fontWeight: 500 }}>
                      {lang === 'kz' ? 'Бөлшек баға (₸)' : 'Розничная цена (₸)'}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'stretch' }}>
                      <input 
                        type="number" 
                        value={product.price || ''}
                        onChange={(e) => handlePriceChange(product.id, e.target.value)}
                        style={{
                          flex: 1,
                          fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)',
                          padding: '12px 16px', borderRadius: '12px 0 0 12px',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                          color: '#fff', outline: 'none', borderRight: 'none',
                          WebkitAppearance: 'none', margin: 0
                        }}
                      />
                      <div style={{ 
                        background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', 
                        borderRadius: '0 12px 12px 0', padding: '0 16px', display: 'flex', alignItems: 'center',
                        color: '#38BDF8', fontWeight: 700, fontSize: 16
                      }}>
                        ₸
                      </div>
                    </div>
                  </div>

                  {/* Stock Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>
                      {lang === 'kz' ? 'Тауар дүкенде бар ма?' : 'Товар есть в наличии?'}
                    </div>
                    
                    {/* Modern Toggle Switch */}
                    <div 
                      onClick={(e) => { e.stopPropagation(); toggleStock(product.id) }} 
                      style={{ 
                        width: 52, height: 30, borderRadius: 15, cursor: 'pointer',
                        background: product.inStock ? '#10B981' : 'rgba(255,255,255,0.1)',
                        position: 'relative', transition: 'background 0.3s'
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 3, left: product.inStock ? 25 : 3,
                        width: 24, height: 24, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }} />
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )
        })}
      </div>

    </div>
  )
}
