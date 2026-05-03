import { useI18n } from '../../i18n/index.js'
import { getDisplayQuantity, computePricePerUnit } from '../../utils/parseQuantity.js'
import { formatPrice } from '../../utils/fitCheck.js'

export default function SpecsGrid({ product }) {
  const { lang, t } = useI18n()
  const specs = []
  const s = product.specs || {}

  if (s.storage) specs.push({ label: t('product.storage'), value: s.storage })
  if (s.bestBefore) specs.push({ label: t('product.expiry'), value: s.bestBefore })

  const perUnit = computePricePerUnit(
    product.priceKzt,
    product.quantityParsed || product.quantity || s.weight
  )
  if (perUnit) {
    if (perUnit.per100 != null) {
      specs.push({
        label: `${t('product.pricePer')} ${perUnit.suffix}`,
        value: formatPrice(perUnit.per100),
      })
    }
    if (perUnit.perUnit != null) {
      specs.push({
        label: `${t('product.pricePer')} ${perUnit.unitSuffix}`,
        value: formatPrice(perUnit.perUnit),
      })
    }
  }

  if (product.flavor) specs.push({ label: t('product.flavor'), value: product.flavor })
  if (s.flavor && !product.flavor) specs.push({ label: t('product.flavor'), value: s.flavor })
  if (product.subcategory) {
    specs.push({ label: t('product.subcategory'), value: product.subcategory })
  }
  if (specs.length === 0) return null

  // lang used via useI18n above — satisfies the hook dependency
  void lang

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {specs.map((spec, i) => (
        <div
          key={i}
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--glass-subtle)',
            border: '1px solid var(--line-soft)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            {spec.label}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
              textAlign: 'right',
              lineHeight: 1.3,
            }}
          >
            {spec.value}
          </div>
        </div>
      ))}
    </div>
  )
}
