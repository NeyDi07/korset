// ProductMockScreen.jsx — мокап V0-редизайна, версия 2 (компактная).
// URL: /_mock/product

import { useNavigate } from 'react-router-dom'
import { formatPrice } from '../../utils/formatPrice.js'

// ═══════════════════════════════════════════════════════════════════════════
// ДАММИ-ПРОДУКТ
// ═══════════════════════════════════════════════════════════════════════════
const MOCK_PRODUCT = {
  ean: '4004234101111',
  name: 'Альпийское молочный шоколад с цельным фундуком',
  category: 'Шоколад · кондитерка',
  brand: 'Ritter Sport',
  manufacturer: { name: 'Alfred Ritter GmbH', country: 'Германия' },
  quantity: '100 г',
  priceKzt: 1356,
  description:
    'Плитка молочного шоколада с жареным лесным орехом и какао из Ганы. Изготовлено по традиционному немецкому рецепту с 1912 года.',
  halalStatus: 'unknown',
  dietTags: ['high_protein'],
  allergens: ['milk', 'tree_nuts', 'soy'],
  ingredients:
    'Сахар, молоко сухое цельное (23%), какао тертое, какао масло, орех тертый (фундук), эмульгатор (соевый лецитин), ароматизатор натуральный. Может содержать следы пшеницы и арахиса.',
  specs: {
    storage: 'От +5 до +20 °C, влажность ≤70%',
    bestBefore: '18 месяцев',
  },
  nutritionPer100: {
    kcal: 547,
    protein: 8,
    fat: 32,
    carbs: 54,
    sugar: 52,
    salt: 0.15,
  },
  fit: {
    severity: 'warning', // danger | warning | caution | safe
    reasons: [
      { text: 'Содержит молоко — ваш аллерген', type: 'danger' },
      { text: 'Высокое содержание сахара', type: 'warning' },
      { text: 'Ультра-обработанный продукт', type: 'caution' },
    ],
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════════════════
function fmt(v) {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

const SEVERITY = {
  danger: {
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.30)',
    title: 'Не подходит',
  },
  warning: {
    color: '#F97316',
    bg: 'rgba(249,115,22,0.10)',
    border: 'rgba(249,115,22,0.30)',
    title: 'Не рекомендуется',
  },
  caution: {
    color: '#FBBF24',
    bg: 'rgba(251,191,36,0.10)',
    border: 'rgba(251,191,36,0.30)',
    title: 'С осторожностью',
  },
  safe: {
    color: '#10B981',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.30)',
    title: 'Подходит',
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// КОМПАКТНЫЙ FIT-CHECK (≤2 причины, иначе "+N")
// ═══════════════════════════════════════════════════════════════════════════
function FitCheckCompact({ fit }) {
  const s = SEVERITY[fit.severity]
  const [r1, r2, ...rest] = fit.reasons

  return (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 14,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: s.color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {fit.severity === 'safe' ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: s.color,
            lineHeight: 1.2,
            marginBottom: 2,
          }}
        >
          {s.title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {r1?.text}
          {r2 && ` · ${r2.text}`}
          {rest.length > 0 && (
            <span style={{ color: s.color, fontWeight: 600 }}> · ещё {rest.length}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DIET BADGES — одинаковый размер через grid
// ═══════════════════════════════════════════════════════════════════════════
const DIET_BADGES = [
  { key: 'halal', label: 'Халал', color: '#10B981', matched: true },
  { key: 'highProtein', label: 'Белки+', color: '#3B82F6', matched: true },
  { key: 'noSugar', label: 'Без сахара', color: '#8B5CF6', matched: false },
  { key: 'glutenFree', label: 'Без глютена', color: '#F59E0B', matched: false },
  { key: 'vegan', label: 'Веган', color: '#10B981', matched: false },
]

// Простые placeholder-иконки (пользователь заменит вручную на свои SVG)
const DIET_ICON_PLACEHOLDERS = {
  halal: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  ),
  highProtein: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <path d="M4 4h16M9 14v6M15 14v6M7 20h10" />
    </svg>
  ),
  noSugar: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <rect x="5" y="9" width="14" height="11" rx="2" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      <path d="M4 4l16 16" />
    </svg>
  ),
  glutenFree: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M12 3v18" />
      <path d="M12 8c-3 0-4 2-4 4M12 8c3 0 4 2 4 4M12 13c-3 0-4 2-4 4M12 13c3 0 4 2 4 4" />
      <path d="M4 4l16 16" />
    </svg>
  ),
  vegan: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M7 20a6 6 0 0 1-5-5c3-2 7-2 9 0M17 20a6 6 0 0 0 5-5c-3-2-7-2-9 0" />
      <path d="M12 20V8" />
    </svg>
  ),
}

function DietBadges() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${DIET_BADGES.length}, 1fr)`,
        gap: 8,
      }}
    >
      {DIET_BADGES.map((b) => (
        <div
          key={b.key}
          style={{
            aspectRatio: '1 / 1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            borderRadius: 14,
            background: b.matched ? `${b.color}12` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${b.matched ? `${b.color}35` : 'rgba(255,255,255,0.06)'}`,
            color: b.matched ? b.color : 'rgba(255,255,255,0.3)',
            opacity: b.matched ? 1 : 0.6,
          }}
        >
          {DIET_ICON_PLACEHOLDERS[b.key]}
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.02em',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {b.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED NUTRITION — ккал + макросы + sugar/salt в одной карточке
// ═══════════════════════════════════════════════════════════════════════════
function NutritionUnified({ nutrition }) {
  if (!nutrition) return null
  const { kcal, fat, carbs, protein, sugar, salt } = nutrition

  return (
    <div
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Пищевая ценность · на 100 г
      </div>

      {/* Верхний ряд: 4 макроса с калориями первыми */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
          marginBottom: 10,
        }}
      >
        <MacroCell label="Ккал" value={kcal} unit="" color="#A78BFA" accent />
        <MacroCell label="Белки" value={protein} unit="г" color="#3B82F6" />
        <MacroCell label="Жиры" value={fat} unit="г" color="#F59E0B" />
        <MacroCell label="Углеводы" value={carbs} unit="г" color="#10B981" />
      </div>

      {/* Нижний ряд: sugar + salt с 3-деленчатой шкалой */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ThreeStepBar label="Сахар" value={sugar} unit="г" thresholds={[5, 22.5]} />
        <ThreeStepBar label="Соль" value={salt} unit="г" thresholds={[0.3, 1.5]} />
      </div>
    </div>
  )
}

function MacroCell({ label, value, unit, color, accent }) {
  return (
    <div
      style={{
        background: accent ? `${color}10` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${accent ? `${color}30` : 'rgba(255,255,255,0.05)'}`,
        borderRadius: 12,
        padding: '10px 6px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 60,
      }}
    >
      <div
        style={{
          fontSize: accent ? 20 : 16,
          fontWeight: 900,
          color: '#fff',
          fontFamily: 'var(--font-display)',
          lineHeight: 1,
        }}
      >
        {fmt(value)}
        {unit && (
          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 1, fontWeight: 600 }}>
            {unit}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: accent ? color : 'var(--text-dim)',
          textTransform: 'uppercase',
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  )
}

function ThreeStepBar({ label, value, unit, thresholds }) {
  if (value == null) return null
  // Активный сегмент: low / med / high
  const [low, high] = thresholds
  let activeIdx = 0
  if (value > high) activeIdx = 2
  else if (value > low) activeIdx = 1
  const statusLabel = ['Низкое', 'Среднее', 'Высокое'][activeIdx]
  const colors = ['#10B981', '#F59E0B', '#EF4444']

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.85)',
          width: 48,
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', gap: 3, flex: 1 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: i === activeIdx ? colors[i] : `${colors[i]}20`,
              boxShadow: i === activeIdx ? `0 0 8px ${colors[i]}70` : 'none',
              transition: 'all 0.2s',
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: colors[activeIdx],
          minWidth: 72,
          textAlign: 'right',
          fontFamily: 'var(--font-display)',
        }}
      >
        {fmt(value)} {unit} ·{' '}
        <span style={{ fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {statusLabel}
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// INGREDIENTS — компактные подсветки, не большие pill-chips
// ═══════════════════════════════════════════════════════════════════════════
const CONFLICT_WORDS = {
  молок: { type: 'allergen' },
  орех: { type: 'allergen' },
  соев: { type: 'allergen' },
  пшениц: { type: 'allergen' },
  арахис: { type: 'allergen' },
  эмульгатор: { type: 'additive' },
  ароматизатор: { type: 'additive' },
  лецитин: { type: 'additive' },
}

function IngredientsBlock({ text }) {
  if (!text) return null
  // Разбиваем на слова с сохранением пробелов и пунктуации
  const tokens = text.split(/(\s+|[,;.()])/g)

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: 14,
        fontSize: 13,
        lineHeight: 1.7,
        color: 'rgba(255,255,255,0.7)',
      }}
    >
      {tokens.map((tok, i) => {
        const clean = tok.toLowerCase().trim()
        if (!clean) return <span key={i}>{tok}</span>
        const match = Object.keys(CONFLICT_WORDS).find((k) => clean.includes(k))
        if (!match) return <span key={i}>{tok}</span>
        const isAllergen = CONFLICT_WORDS[match].type === 'allergen'
        const color = isAllergen ? '#EF4444' : '#F59E0B'
        return (
          <span
            key={i}
            style={{
              color: color,
              fontWeight: 700,
              borderBottom: `1.5px dotted ${color}`,
              paddingBottom: 1,
            }}
          >
            {tok}
          </span>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SPECS — только НЕ дублирующая инфа: хранение, срок, цена за 100г
// ═══════════════════════════════════════════════════════════════════════════
function SpecsGrid({ product }) {
  const specs = []

  if (product.specs?.storage) specs.push({ label: 'Хранение', value: product.specs.storage })
  if (product.specs?.bestBefore)
    specs.push({ label: 'Срок годности', value: product.specs.bestBefore })

  // Цена за 100 г — эвристика
  if (product.priceKzt && product.quantity) {
    const match = String(product.quantity).match(/(\d+\.?\d*)\s*(г|гр|мл|л|кг)/i)
    if (match) {
      const num = Number(match[1])
      const unit = match[2].toLowerCase()
      if (num > 0) {
        let perUnit, suffix
        if (unit === 'г' || unit === 'гр') {
          perUnit = (product.priceKzt / num) * 100
          suffix = '100 г'
        } else if (unit === 'кг') {
          perUnit = (product.priceKzt / num) * 0.1
          suffix = '100 г'
        } else if (unit === 'мл') {
          perUnit = (product.priceKzt / num) * 100
          suffix = '100 мл'
        } else if (unit === 'л') {
          perUnit = (product.priceKzt / num) * 0.1
          suffix = '100 мл'
        }
        if (perUnit) specs.push({ label: `Цена за ${suffix}`, value: `${Math.round(perUnit)} ₸` })
      }
    }
  }

  if (specs.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {specs.map((s, i) => (
        <div
          key={i}
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
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
            {s.label}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              textAlign: 'right',
              lineHeight: 1.3,
            }}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
export default function ProductMockScreen() {
  const navigate = useNavigate()
  const p = MOCK_PRODUCT

  return (
    <div className="screen" style={{ paddingBottom: 140 }}>
      {/* Header — без "Детали", только back/category/fav */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(12,12,14,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {p.category}
        </div>
        <button
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 1. Фото placeholder */}
        <div
          style={{
            width: '100%',
            height: 260,
            borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(59,130,246,0.05))',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-dim)',
            fontSize: 12,
            position: 'relative',
          }}
        >
          📦 Photo carousel (swipe animation — не трогаем)
          {/* Индикатор страниц */}
          <div style={{ position: 'absolute', bottom: 14, display: 'flex', gap: 6 }}>
            <div style={{ width: 20, height: 5, borderRadius: 3, background: '#fff' }} />
            <div
              style={{ width: 5, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.35)' }}
            />
          </div>
        </div>

        {/* 2. Title + price в одном ряду */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
          }}
        >
          <h1
            style={{
              flex: 1,
              fontSize: 20,
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              lineHeight: 1.2,
              color: '#fff',
              margin: 0,
              minWidth: 0,
              wordBreak: 'break-word',
            }}
          >
            {p.name}
          </h1>
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: '#fff',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              paddingTop: 2,
            }}
          >
            {formatPrice(p.priceKzt)}
          </div>
        </div>

        {/* Бренд · Страна · Вес */}
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: -8 }}>
          {p.brand} · {p.manufacturer.country} · {p.quantity}
        </div>

        {/* 3. Компактный Fit-Check */}
        <FitCheckCompact fit={p.fit} />

        {/* 4. Diet Badges (одинаковый размер) */}
        <DietBadges />

        {/* 5. Объединённая Nutrition (kcal + макро + sugar/salt) */}
        <NutritionUnified nutrition={p.nutritionPer100} />

        {/* 6. Ingredients (тонкие подсветки вместо pill-chips) */}
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Состав
          </div>
          <IngredientsBlock text={p.ingredients} />
        </div>

        {/* 7. Description block (вместо слова МОКАП) */}
        {p.description && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Описание
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 14,
                padding: 14,
                fontSize: 13,
                lineHeight: 1.55,
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {p.description}
            </div>
          </div>
        )}

        {/* 8. Characteristics — только НЕ-дубли */}
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Характеристики
          </div>
          <SpecsGrid product={p} />
        </div>
      </div>

      {/* Sticky bottom bar — position:fixed относительно viewport */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(12,12,14,0.95)',
          backdropFilter: 'blur(20px)',
          padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          zIndex: 50,
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          style={{
            flex: 1,
            padding: '12px 8px',
            borderRadius: 12,
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Альтернативы
        </button>
        <button
          style={{
            flex: 1,
            padding: '12px 8px',
            borderRadius: 12,
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
            border: 'none',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
          }}
        >
          ✦ Спросить AI
        </button>
        <button
          style={{
            flex: 1,
            padding: '12px 8px',
            borderRadius: 12,
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Сравнить
        </button>
      </div>
    </div>
  )
}
