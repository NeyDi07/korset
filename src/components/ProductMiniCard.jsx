import { useNavigate } from 'react-router-dom'
import { useI18n } from '../utils/i18n.js'
import { useStore } from '../contexts/StoreContext.jsx'
import { buildProductPath } from '../utils/routes.js'

/**
 * Compact product card used in profile tabs (favorites / history).
 * Renders image, name, short meta line, and an explicit CTA button to open
 * the product detail screen. Whole card is clickable; the CTA stops propagation
 * so the button itself can play its press animation independently.
 */
export default function ProductMiniCard({ product }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { currentStore } = useStore()

  if (!product?.ean && !product?.id) return null

  const image = product.image || product.images?.[0] || null
  const country = product.manufacturer?.country || null
  const meta = [product.quantity, country || product.brand].filter(Boolean).join(' • ')

  const handleOpen = () => {
    if (!product.ean) return
    navigate(buildProductPath(currentStore?.slug || null, product.ean), {
      state: { product },
    })
  }

  return (
    <div
      className="product-mini-card"
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleOpen()
        }
      }}
    >
      <div className="product-mini-card__image-wrap">
        {image ? (
          <img
            src={image}
            alt=""
            className="product-mini-card__image"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="product-mini-card__placeholder" aria-hidden="true">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
        )}
      </div>
      <div className="product-mini-card__name" title={product.name}>
        {product.name}
      </div>
      {meta && <div className="product-mini-card__meta">{meta}</div>}
      <button
        type="button"
        className="product-mini-card__cta"
        onClick={(e) => {
          e.stopPropagation()
          handleOpen()
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 3h6v6" />
          <path d="M10 14L21 3" />
          <path d="M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5" />
        </svg>
        <span>{t.profile.openCard}</span>
      </button>
    </div>
  )
}
