import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProfile } from '../contexts/ProfileContext.jsx'
import { useI18n } from '../utils/i18n.js'
import { useStore } from '../contexts/StoreContext.jsx'
import { checkProductFit, formatPrice } from '../utils/fitCheck.js'
import { getAnyKnownProductByRef, getGlobalDemoProducts, getStoreCatalogProducts } from '../utils/storeCatalog.js'
import { buildProductAIPath, buildProductPath } from '../utils/routes.js'

export default function AlternativesScreen() {
  const { ean, storeSlug } = useParams()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { t } = useI18n()
  const { currentStore } = useStore()
  const activeStoreSlug = storeSlug || currentStore?.slug || null

  const product = useMemo(() => getAnyKnownProductByRef(ean, activeStoreSlug), [ean, activeStoreSlug])
  const baseProducts = useMemo(() => activeStoreSlug ? getStoreCatalogProducts(activeStoreSlug) : getGlobalDemoProducts(), [activeStoreSlug])

  const alternatives = useMemo(() => {
    if (!product) return []
    const preferredCategory = product.category
    return baseProducts
      .filter((item) => item.ean !== product.ean)
      .filter((item) => item.category === preferredCategory)
      .sort((a, b) => {
        const aFit = checkProductFit(a, profile).fits ? 0 : 1
        const bFit = checkProductFit(b, profile).fits ? 0 : 1
        if (aFit !== bFit) return aFit - bFit
        const priceDeltaA = Math.abs((a.priceKzt || 0) - (product.priceKzt || 0))
        const priceDeltaB = Math.abs((b.priceKzt || 0) - (product.priceKzt || 0))
        return priceDeltaA - priceDeltaB
      })
      .slice(0, 6)
  }, [baseProducts, product, profile])

  if (!product) {
    return <div className="screen" style={{ display: 'grid', placeItems: 'center', color: 'var(--text-dim)' }}>{t.common.notFound}</div>
  }

  return (
    <div className="screen">
      <div className="header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ width: 38, height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}>←</button>
        <div className="screen-title" style={{ margin: 0 }}>{t.common.alternatives}</div>
      </div>

      <div style={{ padding: '0 20px 24px', color: 'rgba(220,220,240,0.72)', fontSize: 13, lineHeight: 1.6 }}>
        Подбираем похожие товары для <span style={{ color: '#fff', fontWeight: 700 }}>{product.name}</span>{activeStoreSlug ? ' в рамках текущего магазина.' : '.'}
      </div>

      <div style={{ padding: '0 20px 100px', display: 'grid', gap: 10 }}>
        {alternatives.map((alt) => {
          const fit = checkProductFit(alt, profile)
          return (
            <button key={alt.ean} onClick={() => navigate(buildProductPath(activeStoreSlug, alt.ean))} style={{
              padding: 12, borderRadius: 18, cursor: 'pointer', textAlign: 'left',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 12, alignItems: 'center'
            }}>
              <AltThumb product={alt} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{alt.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(180,180,210,0.65)', marginBottom: 6 }}>{alt.brand || 'Без бренда'} · {alt.shelf || 'Полка уточняется'}</div>
                <div style={{ fontSize: 11, color: fit.fits ? '#34D399' : '#F59E0B' }}>{fit.fits ? 'Подходит профилю' : 'Проверьте состав'}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#A78BFA', whiteSpace: 'nowrap' }}>{formatPrice(alt.priceKzt)}</div>
            </button>
          )
        })}

        <button className="btn btn-secondary btn-full" onClick={() => navigate(buildProductAIPath(activeStoreSlug, product.ean))}>
          {t.alternatives.askAI}
        </button>
      </div>
    </div>
  )
}

function getPrimaryImage(product) {
  if (!product) return null
  if (product.images?.[0]) return product.images[0]
  if (product.ean) return `/products/${product.ean}.png`
  return null
}

function AltThumb({ product }) {
  const src = getPrimaryImage(product)
  const [ok, setOk] = useState(true)
  return (
    <div className="product-thumb" style={{ width: 56, height: 56, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 14 }}>
      {src && ok ? (
        <img src={src} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} onError={() => setOk(false)} />
      ) : (
        <span style={{ color: 'var(--primary-bright)', fontSize: 18 }}>📦</span>
      )}
    </div>
  )
}
