import { useMemo, useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { checkProductFit, formatPrice } from '../utils/fitCheck.js'
import { useProfile } from '../contexts/ProfileContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useI18n } from '../utils/i18n.js'
import { useUserData } from '../contexts/UserDataContext.jsx'
import { useStore } from '../contexts/StoreContext.jsx'
import { useOffline } from '../contexts/OfflineContext.jsx'
import { fetchFullProduct } from '../contexts/StoreContext.jsx'
import { getAnyKnownProductByRef } from '../utils/storeCatalog.js'
import { coerceProductEntity } from '../domain/product/normalizers.js'
import {
  buildCatalogPath,
  buildProductAIPath,
  buildProductAlternativesPath,
} from '../utils/routes.js'
import { buildAuthNavigateState } from '../utils/authFlow.js'
import { DietIcon } from './ProfileScreen.jsx'
import { ONBOARDING_PREFERENCES } from '../constants/dietGoals.js'

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

function resolveSeverityKey(reasons, fits) {
  if (reasons.some((r) => r.type === 'danger')) return 'danger'
  if (reasons.some((r) => r.type === 'warning')) return 'warning'
  if (reasons.some((r) => r.type === 'caution')) return 'caution'
  if (fits === false) return 'danger'
  return 'safe'
}

function getManufacturerText(product) {
  if (!product) return ''
  if (product.manufacturer && typeof product.manufacturer === 'object') {
    const name = product.manufacturer.name || ''
    const country = product.manufacturer.country || ''
    return [name, country].filter(Boolean).join(' · ')
  }
  if (typeof product.manufacturer === 'string') {
    return product.manufacturer.replace(/\s*—\s*демо\s*$/i, '').trim()
  }
  return product.brand || ''
}

function getCountry(product) {
  if (product.manufacturer && typeof product.manufacturer === 'object') {
    return product.manufacturer.country || null
  }
  return product.country || null
}

// Парсим количество ("100 г", "950 мл") → {num, unit}
function parseQuantity(quantityStr) {
  if (!quantityStr) return null
  const match = String(quantityStr).match(
    /(\d+[.,]?\d*)\s*(г|гр|кг|мл|л|грамм|килограмм|миллилитр|литр)/i
  )
  if (!match) return null
  const num = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(num) || num <= 0) return null
  const unitRaw = match[2].toLowerCase()
  const isWeight = ['г', 'гр', 'кг', 'грамм', 'килограмм'].some((u) => unitRaw.startsWith(u))
  const isVolume = ['мл', 'л', 'миллилитр', 'литр'].some((u) => unitRaw.startsWith(u))
  return { num, unit: unitRaw, isWeight, isVolume }
}

// Цена за 100 г или 100 мл
function computePricePerUnit(priceKzt, quantity) {
  if (!priceKzt || !quantity) return null
  const q = parseQuantity(quantity)
  if (!q) return null
  let per100, suffix
  if (q.unit.startsWith('кг') || q.unit.startsWith('килограмм')) {
    per100 = priceKzt / q.num / 10
    suffix = '100 г'
  } else if (q.unit.startsWith('г') || q.unit.startsWith('гр') || q.unit.startsWith('грамм')) {
    per100 = (priceKzt / q.num) * 100
    suffix = '100 г'
  } else if (q.unit.startsWith('л') && !q.unit.startsWith('литр')) {
    // "л" (но не "литр")
    per100 = priceKzt / q.num / 10
    suffix = '100 мл'
  } else if (q.unit.startsWith('литр')) {
    per100 = priceKzt / q.num / 10
    suffix = '100 мл'
  } else if (q.unit.startsWith('мл') || q.unit.startsWith('миллилитр')) {
    per100 = (priceKzt / q.num) * 100
    suffix = '100 мл'
  }
  if (!per100) return null
  return { per100: Math.round(per100), suffix }
}

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE CAROUSEL (оставлен как был — нативный scroll-snap swipe)
// ═══════════════════════════════════════════════════════════════════════════
function ImageCarousel({ images, fallbackEan, singleImage }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollRef = useRef(null)

  const finalImages =
    images && images.length > 0
      ? images
      : singleImage
        ? [singleImage]
        : fallbackEan
          ? [`/products/${fallbackEan}.png`]
          : []

  if (finalImages.length === 0) {
    return (
      <div
        style={{
          height: 280,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim)',
          fontSize: 14,
        }}
      >
        Нет фото
      </div>
    )
  }

  const handleScroll = () => {
    if (!scrollRef.current) return
    const scrollLeft = scrollRef.current.scrollLeft
    const width = scrollRef.current.offsetWidth
    const newIndex = Math.round(scrollLeft / width)
    setCurrentIndex(newIndex)
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 280,
        borderRadius: 20,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          width: '100%',
          height: '100%',
        }}
      >
        {finalImages.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              scrollSnapAlign: 'start',
              flexShrink: 0,
            }}
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
        ))}
      </div>
      {finalImages.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {finalImages.map((_, i) => (
            <div
              key={i}
              style={{
                width: currentIndex === i ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: currentIndex === i ? '#fff' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COLLAPSIBLE FIT-CHECK (средний размер, раскрывается кликом)
// ═══════════════════════════════════════════════════════════════════════════
function CollapsibleFitCheck({ severityKey, reasons }) {
  const [expanded, setExpanded] = useState(false)
  const s = SEVERITY[severityKey]
  const canExpand = reasons.length > 0 && severityKey !== 'safe'

  return (
    <button
      onClick={() => canExpand && setExpanded((x) => !x)}
      disabled={!canExpand}
      style={{
        width: '100%',
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 16,
        padding: '14px 16px',
        cursor: canExpand ? 'pointer' : 'default',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: expanded ? 12 : 0,
        transition: 'gap 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: s.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 4px 12px ${s.color}50`,
          }}
        >
          {severityKey === 'safe' && (
            // Shield with check — безопасно
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          )}
          {severityKey === 'caution' && (
            // Alert-circle — осторожно
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {severityKey === 'warning' && (
            // Alert-triangle — не рекомендуется
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
          {severityKey === 'danger' && (
            // Shield-X — не подходит
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <line x1="9.5" y1="9.5" x2="14.5" y2="14.5" />
              <line x1="14.5" y1="9.5" x2="9.5" y2="14.5" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: s.color,
              fontFamily: 'var(--font-display)',
              lineHeight: 1.15,
            }}
          >
            {s.title}
          </div>
          {canExpand && !expanded && (
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.45)',
                marginTop: 2,
                letterSpacing: '0.02em',
              }}
            >
              {reasons.length} {reasons.length === 1 ? 'причина' : 'причины'} — нажмите для деталей
            </div>
          )}
        </div>
        {canExpand && (
          <div
            style={{
              color: s.color,
              flexShrink: 0,
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        )}
      </div>
      {expanded && canExpand && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            paddingLeft: 48,
            borderTop: `1px solid ${s.border}`,
            marginTop: 4,
            paddingTop: 12,
          }}
        >
          {reasons.map((r, i) => {
            const rColor = SEVERITY[r.type]?.color || 'rgba(255,255,255,0.7)'
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.85)',
                  lineHeight: 1.4,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: rColor,
                    marginTop: 6,
                    flexShrink: 0,
                    boxShadow: `0 0 6px ${rColor}`,
                  }}
                />
                <span>{r.text}</span>
              </div>
            )
          })}
        </div>
      )}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DIET BADGES — иконки из профиля (ONBOARDING_PREFERENCES)
// ═══════════════════════════════════════════════════════════════════════════
// Цвета для каждого preference (совпадают с профилем — фиолетовый акцент)
const DIET_BADGE_COLORS = {
  halal: '#10B981',
  sugar_free: '#8B5CF6',
  dairy_free: '#06B6D4',
  gluten_free: '#F59E0B',
  vegan: '#10B981',
  vegetarian: '#22C55E',
  keto: '#EC4899',
  kid_friendly: '#3B82F6',
}

// Фиксированный порядок для product-экрана (самые релевантные 5 из профиля)
const BADGE_KEYS = ['halal', 'sugar_free', 'gluten_free', 'dairy_free', 'vegan']

function matchBadge(key, product) {
  const diet = product.dietTags || []
  if (key === 'halal') return product.halalStatus === 'yes' || product.halal === 'yes'
  return diet.includes(key)
}

function DietBadges({ product, lang }) {
  const badges = BADGE_KEYS.map((id) => {
    const pref = ONBOARDING_PREFERENCES.find((p) => p.id === id)
    if (!pref) return null
    return {
      id,
      iconName: pref.icon,
      label: pref.label[lang] || pref.label.ru,
      color: DIET_BADGE_COLORS[id] || '#8B5CF6',
      matched: matchBadge(id, product),
    }
  }).filter(Boolean)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${badges.length}, 1fr)`,
        gap: 8,
      }}
    >
      {badges.map((b) => (
        <div
          key={b.id}
          style={{
            aspectRatio: '1 / 1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderRadius: 14,
            background: b.matched ? `${b.color}14` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${b.matched ? `${b.color}38` : 'rgba(255,255,255,0.06)'}`,
            color: b.matched ? b.color : 'rgba(255,255,255,0.28)',
            opacity: b.matched ? 1 : 0.5,
            transition: 'all 0.2s',
          }}
        >
          <DietIcon name={b.iconName} size={22} />
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.02em',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              lineHeight: 1,
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
// NUTRITION UNIFIED (5 ячеек + sugar/salt одинаковой длины)
// ═══════════════════════════════════════════════════════════════════════════
function NutritionUnified({ nutrition }) {
  if (!nutrition) return null
  const kcal = nutrition.kcal ?? nutrition.energy_kcal_100g
  const protein = nutrition.protein ?? nutrition.proteins_100g
  const fat = nutrition.fat ?? nutrition.fat_100g
  const carbs = nutrition.carbs ?? nutrition.carbohydrates_100g
  const sugar = nutrition.sugar ?? nutrition.sugars_100g ?? nutrition.sugars
  const salt = nutrition.salt ?? nutrition.salt_100g
  const saturatedFat = nutrition.saturatedFat ?? nutrition.saturated_fat_100g

  const hasAny = [kcal, protein, fat, carbs, sugar, salt, saturatedFat].some((v) => v != null)
  if (!hasAny) return null

  // 5-й динамический элемент: sat.fat > sugar (если еще не в нижнем блоке) > клетчатка
  const fifthCell =
    saturatedFat != null
      ? { label: 'Нас. жиры', value: saturatedFat, unit: 'г', color: '#EC4899' }
      : null

  const hasSugarSalt = sugar != null || salt != null

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

      {/* Ряд 1: ккал + 3-4 макроса */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: fifthCell ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)',
          gap: 6,
          marginBottom: hasSugarSalt ? 12 : 0,
        }}
      >
        <MacroCell label="Ккал" value={kcal} unit="" color="#A78BFA" accent bigger />
        <MacroCell label="Белки" value={protein} unit="г" color="#3B82F6" />
        <MacroCell label="Жиры" value={fat} unit="г" color="#F59E0B" />
        <MacroCell label="Углев." value={carbs} unit="г" color="#10B981" />
        {fifthCell && (
          <MacroCell
            label={fifthCell.label}
            value={fifthCell.value}
            unit={fifthCell.unit}
            color={fifthCell.color}
          />
        )}
      </div>

      {/* Ряд 2: sugar + salt с одинаковыми индикаторами (через grid) */}
      {hasSugarSalt && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr 96px',
            rowGap: 8,
            columnGap: 10,
            alignItems: 'center',
            paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {sugar != null && (
            <ThreeStepRow label="Сахар" value={sugar} unit="г" thresholds={[5, 22.5]} />
          )}
          {salt != null && (
            <ThreeStepRow label="Соль" value={salt} unit="г" thresholds={[0.3, 1.5]} />
          )}
        </div>
      )}
    </div>
  )
}

function MacroCell({ label, value, unit, color, accent, bigger }) {
  return (
    <div
      style={{
        background: accent ? `${color}12` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${accent ? `${color}30` : 'rgba(255,255,255,0.05)'}`,
        borderRadius: 12,
        padding: '10px 4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 62,
      }}
    >
      <div
        style={{
          fontSize: bigger ? 22 : 16,
          fontWeight: 900,
          color: '#fff',
          fontFamily: 'var(--font-display)',
          lineHeight: 1,
          letterSpacing: '-0.01em',
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
          marginTop: 5,
        }}
      >
        {label}
      </div>
    </div>
  )
}

function ThreeStepRow({ label, value, unit, thresholds }) {
  const [low, high] = thresholds
  let activeIdx = 0
  if (value > high) activeIdx = 2
  else if (value > low) activeIdx = 1
  const statusLabel = ['Низкое', 'Среднее', 'Высокое'][activeIdx]
  const colors = ['#10B981', '#F59E0B', '#EF4444']

  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: i === activeIdx ? colors[i] : `${colors[i]}25`,
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
          textAlign: 'right',
          fontFamily: 'var(--font-display)',
          whiteSpace: 'nowrap',
        }}
      >
        {fmt(value)} {unit}
        <span
          style={{
            fontSize: 9,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            display: 'block',
            opacity: 0.85,
            lineHeight: 1,
          }}
        >
          {statusLabel}
        </span>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// INGREDIENTS (тонкие подсветки)
// ═══════════════════════════════════════════════════════════════════════════
const CONFLICT_WORDS = {
  молок: { type: 'allergen' },
  лактоз: { type: 'allergen' },
  орех: { type: 'allergen' },
  фундук: { type: 'allergen' },
  миндал: { type: 'allergen' },
  арахис: { type: 'allergen' },
  соев: { type: 'allergen' },
  соя: { type: 'allergen' },
  пшениц: { type: 'allergen' },
  глютен: { type: 'allergen' },
  яиц: { type: 'allergen' },
  яйц: { type: 'allergen' },
  эмульгатор: { type: 'additive' },
  ароматизатор: { type: 'additive' },
  консервант: { type: 'additive' },
  краситель: { type: 'additive' },
  лецитин: { type: 'additive' },
  диоксид: { type: 'additive' },
}

function IngredientsBlock({ text, userAllergens = [] }) {
  if (!text) return null

  const extraLowered = userAllergens.map((a) => String(a).toLowerCase())
  const conflicts = { ...CONFLICT_WORDS }
  extraLowered.forEach((a) => {
    if (a && a.length > 2) conflicts[a] = { type: 'allergen', user: true }
  })

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
        const match = Object.keys(conflicts).find((k) => clean.includes(k))
        if (!match) return <span key={i}>{tok}</span>
        const isAllergen = conflicts[match].type === 'allergen'
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
// SPECS GRID — динамический, без повторов сверху
// ═══════════════════════════════════════════════════════════════════════════
function SpecsGrid({ product }) {
  const specs = []
  const s = product.specs || {}

  if (s.storage) specs.push({ label: 'Хранение', value: s.storage })
  if (s.bestBefore) specs.push({ label: 'Срок годности', value: s.bestBefore })

  // Цена за 100 г/мл
  const perUnit = computePricePerUnit(product.priceKzt, product.quantity || s.weight)
  if (perUnit)
    specs.push({
      label: `Цена за ${perUnit.suffix}`,
      value: `${perUnit.per100.toLocaleString('ru-RU')} ₸`,
    })

  // Динамические поля: вкус, категория (подкатегория), alcohol, etc.
  if (product.flavor) specs.push({ label: 'Вкус', value: product.flavor })
  if (s.flavor && !product.flavor) specs.push({ label: 'Вкус', value: s.flavor })
  if (product.subcategory && !['grocery', 'general'].includes(product.subcategory)) {
    specs.push({ label: 'Подкатегория', value: product.subcategory })
  }
  if (specs.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {specs.map((spec, i) => (
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
            {spec.label}
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
            {spec.value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION LABEL
// ═══════════════════════════════════════════════════════════════════════════
function SectionLabel({ children }) {
  return (
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
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function ProductScreen() {
  const { ean, storeSlug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useProfile()
  const { user } = useAuth()
  const { lang, t } = useI18n()
  const { currentStore } = useStore()
  const { checkIsFavorite, toggleFavorite } = useUserData()
  const { isOnline, formatCacheAge } = useOffline()

  const activeStoreSlug = storeSlug || currentStore?.slug || null
  const { storeId } = useStore()
  const baseProduct = useMemo(() => {
    const known = getAnyKnownProductByRef(ean, activeStoreSlug)
    const stateProduct = coerceProductEntity(location.state?.product)
    if (known) return known
    if (stateProduct && stateProduct.ean === ean) return stateProduct
    return stateProduct || null
  }, [ean, activeStoreSlug, location.state])

  const [fullProduct, setFullProduct] = useState(null)
  const needsFullFetch =
    baseProduct &&
    navigator.onLine &&
    storeId &&
    (!baseProduct.ingredients ||
      !baseProduct.description ||
      Object.keys(baseProduct.nutritionPer100 || {}).length === 0)

  useEffect(() => {
    if (!needsFullFetch) return
    let aborted = false
    fetchFullProduct(storeId, ean).then((fp) => {
      if (!aborted && fp) setFullProduct(fp)
    })
    return () => {
      aborted = true
    }
  }, [needsFullFetch, storeId, ean])

  const product = fullProduct || baseProduct

  const isFavorite = checkIsFavorite(product?.ean)

  const handleToggleFavorite = async () => {
    if (!user) {
      navigate('/auth', {
        state: buildAuthNavigateState(location, {
          reason: 'favorites_requires_auth',
          message:
            lang === 'kz'
              ? 'Таңдаулыларға қосу үшін аккаунтқа кіріңіз.'
              : 'Войдите, чтобы добавлять товары в избранное.',
        }),
      })
      return
    }
    await toggleFavorite(product)
  }

  if (!product) {
    return (
      <div
        className="screen"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
        }}
      >
        <div style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <p>{t.common.notFound}</p>
          <button
            className="btn btn-secondary"
            style={{ marginTop: 16 }}
            onClick={() => navigate(buildCatalogPath(activeStoreSlug))}
          >
            {t.product.backToList}
          </button>
        </div>
      </div>
    )
  }

  const { fits, reasons } = checkProductFit(product, profile)
  const severityKey = resolveSeverityKey(reasons, fits)

  const manufacturerText = getManufacturerText(product)
  const country = getCountry(product)
  const quantity = product.quantity || product.specs?.weight
  const perUnit = computePricePerUnit(product.priceKzt, quantity)

  // Подстрока "Бренд · Страна · Вес"
  const subtitleParts = [
    product.brand,
    country && (typeof country === 'string' ? country : null),
    quantity,
  ].filter(Boolean)
  // Fallback: если нет brand, используем manufacturer name
  const subtitleText = subtitleParts.length > 0 ? subtitleParts.join(' · ') : manufacturerText || ''

  return (
    <div
      className="screen"
      style={{
        paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {/* HEADER — без "Детали" */}
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
            stroke="rgba(255,255,255,0.9)"
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
          {product.category || product.subcategory || ''}
        </div>
        <button
          onClick={handleToggleFavorite}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            background: isFavorite ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={isFavorite ? '#EF4444' : 'none'}
            stroke={isFavorite ? '#EF4444' : 'rgba(255,255,255,0.9)'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* CONTENT */}
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 1. Фото-карусель (оставляем как была — swipe animation) */}
        <ImageCarousel
          images={product.images}
          fallbackEan={product.ean}
          singleImage={product.image}
        />

        {/* 2. Title + Price в одну строку */}
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
              lineHeight: 1.22,
              color: '#fff',
              margin: 0,
              minWidth: 0,
              wordBreak: 'break-word',
            }}
          >
            {product.name}
          </h1>
          {product.priceKzt != null && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 2,
                flexShrink: 0,
                paddingTop: 2,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#fff',
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                }}
              >
                {formatPrice(product.priceKzt)}
              </div>
              {perUnit && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--text-dim)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                  }}
                >
                  {perUnit.per100.toLocaleString('ru-RU')} ₸ / {perUnit.suffix}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Brand · Country · Quantity */}
        {subtitleText && (
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: -8 }}>
            {subtitleText}
          </div>
        )}

        {/* 4. Collapsible Fit-Check */}
        <CollapsibleFitCheck severityKey={severityKey} reasons={reasons} />

        {/* Offline indicator */}
        {!isOnline && formatCacheAge() && (
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center',
              marginTop: -8,
            }}
          >
            {t.scan.offlineCacheLabel} ({formatCacheAge()})
          </div>
        )}

        {/* 5. Diet Badges */}
        <DietBadges product={product} lang={lang} />

        {/* 6. Nutrition (5 ячеек + sugar/salt bars) */}
        <NutritionUnified nutrition={product.nutritionPer100} />

        {/* 7. Ingredients */}
        {product.ingredients && (
          <div>
            <SectionLabel>Состав</SectionLabel>
            <IngredientsBlock
              text={product.ingredients}
              userAllergens={profile?.allergens || product.allergens || []}
            />
          </div>
        )}

        {/* 8. Description */}
        {product.description && (
          <div>
            <SectionLabel>Описание</SectionLabel>
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
              {product.description}
            </div>
          </div>
        )}

        {/* 9. Characteristics */}
        <div>
          <SectionLabel>Характеристики</SectionLabel>
          <SpecsGrid product={product} />
        </div>

        {/* 10. Bottom action buttons — В ПОТОКЕ (не fixed) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => navigate(buildProductAlternativesPath(activeStoreSlug, product.ean))}
              style={{
                flex: 1,
                padding: '14px 10px',
                borderRadius: 14,
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
              Альтернативы
            </button>
            <button
              onClick={() => navigate(buildProductAIPath(activeStoreSlug, product.ean))}
              style={{
                flex: 1,
                padding: '14px 10px',
                borderRadius: 14,
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                border: 'none',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 6px 18px rgba(124,58,237,0.35)',
              }}
            >
              {/* AI иконка — та же что в BottomNav */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                <path d="M12 1.99996C12.9057 1.99996 13.7829 2.12194 14.6172 2.34762C14.2223 3.14741 14 4.04768 14 4.99997C14 8.31368 16.6863 11 20 11C20.6685 11 21.3106 10.8882 21.9111 10.6865C21.9676 11.1165 22 11.5546 22 12C22 17.5228 17.5228 22 12 22C10.2975 22 8.69425 21.5746 7.29102 20.8242L2 22L3.17578 16.709C2.42542 15.3057 2 13.7025 2 12C2.00002 6.47714 6.47717 1.99996 12 1.99996ZM19.5293 1.3193C19.7058 0.893513 20.2942 0.8935 20.4707 1.3193L20.7236 1.93063C21.1555 2.97343 21.9615 3.80614 22.9746 4.2568L23.6914 4.57614C24.1022 4.75882 24.1022 5.35635 23.6914 5.53903L22.9326 5.87692C21.945 6.3162 21.1534 7.11943 20.7139 8.1279L20.4668 8.69333C20.2863 9.10747 19.7136 9.10747 19.5332 8.69333L19.2861 8.1279C18.8466 7.11942 18.0551 6.3162 17.0674 5.87692L16.3076 5.53903C15.8974 5.35618 15.8974 4.75895 16.3076 4.57614L17.0254 4.2568C18.0384 3.80614 18.8445 2.97343 19.2764 1.93063L19.5293 1.3193Z" />
              </svg>
              Спросить AI
            </button>
          </div>
          <button
            onClick={() => {
              sessionStorage.setItem('korset_compare_a', JSON.stringify(product))
              navigate(buildCatalogPath(activeStoreSlug))
            }}
            style={{
              width: '100%',
              padding: '13px 16px',
              borderRadius: 14,
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--text-sub)',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            {t.compare?.btnLabel || 'Добавить к сравнению'}
          </button>
        </div>
      </div>
    </div>
  )
}
