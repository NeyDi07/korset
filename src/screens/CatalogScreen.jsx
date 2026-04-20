import { useState, useMemo, useEffect, useCallback, useRef, forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso'
import { checkProductFit, formatPrice } from '../utils/fitCheck.js'
import { useProfile } from '../contexts/ProfileContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useOffline } from '../contexts/OfflineContext.jsx'
import { useI18n } from '../utils/i18n.js'
import { getGlobalDemoProducts, getStoreCatalogProducts } from '../utils/storeCatalog.js'
import { getCatalogFromIndexedDB } from '../utils/offlineDB.js'
import { buildProductPath, buildComparePath } from '../utils/routes.js'

function ProductThumb({ product }) {
  const [imgOk, setImgOk] = useState(true)
  const src = product.image || product.imageUrl || product.images?.[0]
  if (src && imgOk) {
    return (
      <img
        src={src}
        alt={product.name}
        onError={() => setImgOk(false)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
      />
    )
  }
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        fontSize: 28,
        fontWeight: 800,
        color: '#A78BFA',
      }}
    >
      {product.name?.[0] || '•'}
    </div>
  )
}

const GridList = forwardRef(({ style, children, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    style={{
      ...style,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      paddingLeft: 20,
      paddingRight: 20,
      paddingBottom: 100,
    }}
  >
    {children}
  </div>
))

const GridItem = forwardRef(({ style, children, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    style={{
      ...style,
      width: 'calc(50% - 5px)',
      boxSizing: 'border-box',
    }}
  >
    {children}
  </div>
))

const gridComponents = { List: GridList, Item: GridItem }

const ListFooter = forwardRef(({ style, ...props }, ref) => (
  <div ref={ref} style={{ ...style, height: 100 }} {...props} />
))

export default function CatalogScreen() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { profile } = useProfile()
  const { storeId, currentStore, catalogProducts, isCatalogReady } = useStore()
  const { isOnline } = useOffline()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('fit')
  const [viewMode, setViewMode] = useState(
    () => sessionStorage.getItem('korset_catalog_view') || 'list'
  )
  const virtuosoRef = useRef(null)
  const [initialScrollIndex] = useState(() =>
    parseInt(sessionStorage.getItem('korset_catalog_scroll') || '0', 10)
  )

  const [offlineCatalog, setOfflineCatalog] = useState([])

  useEffect(() => {
    if (!isOnline && (!catalogProducts || catalogProducts.length === 0)) {
      getCatalogFromIndexedDB()
        .then((data) => {
          if (data && data.length > 0) setOfflineCatalog(data)
        })
        .catch(() => {})
    }
  }, [isOnline, catalogProducts])

  const baseProducts = useMemo(() => {
    if (storeId && catalogProducts.length > 0) return catalogProducts
    if (!isOnline && offlineCatalog.length > 0) return offlineCatalog
    if (currentStore?.slug) return getStoreCatalogProducts(currentStore.slug)
    return getGlobalDemoProducts()
  }, [storeId, catalogProducts, currentStore, isOnline, offlineCatalog])

  const hasProfile = Boolean(
    profile?.halal || profile?.halalOnly || profile?.allergens?.length || profile?.dietGoals?.length
  )
  const categoryOptions = useMemo(() => {
    const dynamic = [...new Set(baseProducts.map((product) => product.category).filter(Boolean))]
    return ['all', ...(hasProfile ? ['fit'] : []), ...dynamic]
  }, [baseProducts, hasProfile])

  const list = useMemo(() => {
    let arr = [...baseProducts]
    if (filter === 'fit') {
      arr = arr.filter((product) => checkProductFit(product, profile).fits)
    } else if (filter !== 'all') {
      arr = arr.filter((product) => product.category === filter)
    }

    const query = q.trim().toLowerCase()
    if (query) {
      arr = arr.filter((product) =>
        `${product.name} ${product.brand || ''} ${(product.tags || []).join(' ')}`
          .toLowerCase()
          .includes(query)
      )
    }

    arr.sort((a, b) => {
      if (sort === 'cheap') return (a.priceKzt || 0) - (b.priceKzt || 0)
      if (sort === 'pricey') return (b.priceKzt || 0) - (a.priceKzt || 0)
      if (sort === 'rating') return (b.qualityScore || 0) - (a.qualityScore || 0)
      const aFit = checkProductFit(a, profile).fits ? 0 : 1
      const bFit = checkProductFit(b, profile).fits ? 0 : 1
      if (aFit !== bFit) return aFit - bFit
      return (b.qualityScore || 0) - (a.qualityScore || 0)
    })

    return arr
  }, [baseProducts, filter, profile, q, sort])

  const [comparePin, setComparePin] = useState(() => {
    try {
      const s = sessionStorage.getItem('korset_compare_a')
      return s ? JSON.parse(s) : null
    } catch {
      return null
    }
  })

  const handleCompare = useCallback(
    (product, e) => {
      e.stopPropagation()
      const slug = currentStore?.slug || null
      if (!comparePin) {
        sessionStorage.setItem('korset_compare_a', JSON.stringify(product))
        setComparePin(product)
      } else if (comparePin.ean === product.ean) {
        sessionStorage.removeItem('korset_compare_a')
        setComparePin(null)
      } else {
        sessionStorage.removeItem('korset_compare_a')
        setComparePin(null)
        navigate(buildComparePath(slug, comparePin.ean, product.ean), {
          state: { productA: comparePin, productB: product },
        })
      }
    },
    [comparePin, currentStore, navigate]
  )

  const handleNavigate = useCallback(
    (product) => {
      if (virtuosoRef.current) {
        virtuosoRef.current.getState((state) => {
          if (state?.range?.startIndex != null) {
            sessionStorage.setItem('korset_catalog_scroll', String(state.range.startIndex))
          }
        })
      }
      navigate(buildProductPath(currentStore?.slug || null, product.ean), {
        state: { product },
      })
    },
    [currentStore, navigate]
  )

  const storeTitle = currentStore ? currentStore.name : 'Каталог Körset'

  const searchHint =
    !isCatalogReady && q.trim() ? t.catalog?.loadingSearch || 'Каталог загружается...' : null

  const renderGridItem = useCallback(
    (index, product) => {
      const fit = checkProductFit(product, profile)
      return (
        <div
          onClick={() => handleNavigate(product)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 18,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            position: 'relative',
            height: '100%',
          }}
        >
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: fit.fits ? '#34D399' : '#F87171',
                boxShadow: `0 0 10px ${fit.fits ? '#34D399' : '#F87171'}`,
              }}
            />
          </div>
          <div
            style={{
              width: '100%',
              aspectRatio: '1/1',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.03)',
              overflow: 'hidden',
              marginBottom: 10,
            }}
          >
            <ProductThumb product={product} />
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              marginBottom: 6,
              flex: 1,
            }}
          >
            {product.name}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginTop: 'auto',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                fontWeight: 900,
                color: '#A78BFA',
              }}
            >
              {formatPrice(product.priceKzt)}
            </div>
            <button
              onClick={(e) => handleCompare(product, e)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                cursor: 'pointer',
                background:
                  comparePin?.ean === product.ean
                    ? 'rgba(124,58,237,0.4)'
                    : comparePin
                      ? 'rgba(52,211,153,0.15)'
                      : 'rgba(124,58,237,0.15)',
                border: `1px solid ${comparePin?.ean === product.ean ? 'rgba(139,92,246,0.8)' : comparePin ? 'rgba(52,211,153,0.5)' : 'rgba(139,92,246,0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 14,
                  color:
                    comparePin?.ean === product.ean
                      ? '#C4B5FD'
                      : comparePin
                        ? '#34D399'
                        : '#A78BFA',
                }}
              >
                {comparePin?.ean === product.ean ? 'close' : comparePin ? 'add' : 'compare_arrows'}
              </span>
            </button>
          </div>
        </div>
      )
    },
    [profile, comparePin, handleCompare, handleNavigate]
  )

  const renderListItem = useCallback(
    (index, product) => {
      const fit = checkProductFit(product, profile)
      return (
        <div
          onClick={() => handleNavigate(product)}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 18,
            padding: 12,
            margin: '0 20px',
            display: 'grid',
            gridTemplateColumns: '92px 1fr',
            gap: 12,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.03)',
              overflow: 'hidden',
            }}
          >
            <ProductThumb product={product} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                gap: 12,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#fff',
                  lineHeight: 1.35,
                }}
              >
                {product.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: fit.fits ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
                  color: fit.fits ? '#34D399' : '#F87171',
                  flexShrink: 0,
                }}
              >
                {fit.fits ? 'Подходит' : 'Проверить'}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(200,200,240,0.62)', marginBottom: 10 }}>
              {product.brand || 'Без бренда'} · {product.ean}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'end',
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 22,
                    fontWeight: 900,
                    color: '#A78BFA',
                  }}
                >
                  {formatPrice(product.priceKzt)}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(180,180,210,0.6)' }}>
                  {product.shelf || 'Полка уточняется'}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 11, color: 'rgba(220,220,240,0.65)' }}>
                  Score {product.qualityScore || 0}/100
                </div>
                <button
                  onClick={(e) => handleCompare(product, e)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background:
                      comparePin?.ean === product.ean
                        ? 'rgba(124,58,237,0.35)'
                        : comparePin
                          ? 'rgba(52,211,153,0.12)'
                          : 'rgba(124,58,237,0.12)',
                    border: `1px solid ${comparePin?.ean === product.ean ? 'rgba(139,92,246,0.7)' : comparePin ? 'rgba(52,211,153,0.4)' : 'rgba(139,92,246,0.25)'}`,
                    color:
                      comparePin?.ean === product.ean
                        ? '#C4B5FD'
                        : comparePin
                          ? '#34D399'
                          : '#A78BFA',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                    {comparePin?.ean === product.ean
                      ? 'close'
                      : comparePin
                        ? 'add'
                        : 'compare_arrows'}
                  </span>
                  {comparePin?.ean === product.ean
                    ? 'Отменить'
                    : comparePin
                      ? t.compare?.btnLabel || 'Сравнить'
                      : t.compare?.compareMode || 'Сравнить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    },
    [profile, comparePin, handleCompare, handleNavigate, t]
  )

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1,
            }}
          >
            {t.catalog.title}
          </div>
          <div
            style={{ fontSize: 12, color: 'rgba(167,139,250,0.7)', marginTop: 6, fontWeight: 600 }}
          >
            {storeTitle} ·{' '}
            {!isCatalogReady && catalogProducts.length === 0
              ? t.catalog?.loading || 'Загрузка...'
              : `${list.length} товаров${!isCatalogReady ? ' · ' + (t.catalog?.loadingMore || 'ещё загружается...') : ''}`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.catalog.searchPlaceholder}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: 14,
                }}
              />
            </div>
            {searchHint && (
              <div
                style={{
                  position: 'absolute',
                  left: 14,
                  bottom: -18,
                  fontSize: 10,
                  color: 'rgba(251,191,36,0.9)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {searchHint}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              const next = viewMode === 'list' ? 'grid' : 'list'
              setViewMode(next)
              sessionStorage.setItem('korset_catalog_view', next)
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(220,220,240,0.8)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              {viewMode === 'list' ? 'grid_view' : 'view_list'}
            </span>
          </button>
        </div>

        <div
          style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 10 }}
        >
          {categoryOptions.map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                background: filter === option ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${filter === option ? 'rgba(124,58,237,0.42)' : 'rgba(255,255,255,0.08)'}`,
                color: filter === option ? '#C4B5FD' : 'rgba(220,220,240,0.7)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {option === 'all'
                ? t.catalog.filters.all
                : option === 'fit'
                  ? t.catalog.filters.fit
                  : option}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { id: 'fit', label: t.catalog.sort.fit },
            { id: 'cheap', label: t.catalog.sort.cheap },
            { id: 'pricey', label: t.catalog.sort.pricey },
            { id: 'rating', label: t.catalog.sort.rating },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setSort(option.id)}
              style={{
                padding: '7px 10px',
                borderRadius: 12,
                cursor: 'pointer',
                background: sort === option.id ? 'rgba(96,165,250,0.14)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${sort === option.id ? 'rgba(96,165,250,0.32)' : 'rgba(255,255,255,0.08)'}`,
                color: sort === option.id ? '#93C5FD' : 'rgba(220,220,240,0.7)',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {comparePin && (
        <div
          style={{
            margin: '0 20px 10px',
            padding: '12px 14px',
            borderRadius: 16,
            background: 'rgba(124,58,237,0.15)',
            border: '1.5px solid rgba(139,92,246,0.5)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            animation: 'compareBarIn 0.25s ease',
            flexShrink: 0,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 20, color: '#A78BFA', flexShrink: 0 }}
          >
            compare_arrows
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#A78BFA',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              {t.compare?.modeBanner || 'Режим сравнения'}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#E9D5FF',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {comparePin.name}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(196,181,253,0.7)', marginTop: 1 }}>
              Выберите второй товар для сравнения
            </div>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem('korset_compare_a')
              setComparePin(null)
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#A78BFA' }}>
              close
            </span>
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        {viewMode === 'grid' ? (
          <VirtuosoGrid
            ref={virtuosoRef}
            data={list}
            components={gridComponents}
            itemContent={renderGridItem}
            overscan={600}
            initialTopMostItemIndex={initialScrollIndex}
          />
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={list}
            itemContent={renderListItem}
            overscan={600}
            components={{ Footer: ListFooter }}
            initialTopMostItemIndex={initialScrollIndex}
          />
        )}
      </div>

      <style>{`
        @keyframes compareBarIn {
          from { opacity: 0; transform: translateY(-8px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  )
}
