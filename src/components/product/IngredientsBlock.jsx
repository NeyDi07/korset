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

export default function IngredientsBlock({ text, userAllergens = [] }) {
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
        background: 'var(--glass-subtle)',
        border: '1px solid var(--glass-soft-border)',
        borderRadius: 14,
        padding: 14,
        fontSize: 13,
        lineHeight: 1.7,
        color: 'var(--text-soft)',
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
