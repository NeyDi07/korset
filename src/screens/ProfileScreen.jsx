import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadProfile, saveProfile } from '../utils/profile.js'

const DIET_GOALS = [
  { id: 'sugar_free',  label: 'Без сахара',      emoji: '🚫🍬' },
  { id: 'dairy_free',  label: 'Без молочки',      emoji: '🥛'   },
  { id: 'gluten_free', label: 'Без глютена',      emoji: '🌾'   },
  { id: 'vegan',       label: 'Веган',            emoji: '🌿'   },
  { id: 'vegetarian',  label: 'Вегетарианец',     emoji: '🥦'   },
  { id: 'keto',        label: 'Кето',             emoji: '🥑'   },
  { id: 'low_calorie', label: 'Меньше калорий',   emoji: '⚖️'   },
]

const ALLERGENS = [
  { id: 'milk',      label: 'Молоко',    emoji: '🥛' },
  { id: 'gluten',    label: 'Глютен',    emoji: '🌾' },
  { id: 'nuts',      label: 'Орехи',     emoji: '🌰' },
  { id: 'peanuts',   label: 'Арахис',    emoji: '🥜' },
  { id: 'soy',       label: 'Соя',       emoji: '🫘' },
  { id: 'eggs',      label: 'Яйца',      emoji: '🥚' },
  { id: 'fish',      label: 'Рыба',      emoji: '🐟' },
  { id: 'shellfish', label: 'Моллюски',  emoji: '🦐' },
]

const PRIORITIES = [
  { id: 'price',    label: 'Цена',     emoji: '💰', desc: 'Ищу дешевле' },
  { id: 'balanced', label: 'Баланс',   emoji: '⚖️', desc: 'Цена + качество' },
  { id: 'quality',  label: 'Качество', emoji: '⭐', desc: 'Лучший состав' },
]

export default function ProfileScreen() {
  const navigate = useNavigate()
  const allergenInputRef = useRef(null)
  const [profile, setProfile] = useState(() => {
    const s = loadProfile()
    return {
      halal: s.halal || false,
      dietGoals: s.dietGoals || [],
      allergens: s.allergens || [],
      customAllergens: s.customAllergens || [],
      priority: s.priority || 'balanced',
    }
  })
  const [allergenInput, setAllergenInput] = useState('')

  useEffect(() => {
    saveProfile({ ...profile, presetId: 'custom' })
  }, [profile])

  const toggleDiet = id => setProfile(p => ({
    ...p, dietGoals: p.dietGoals.includes(id) ? p.dietGoals.filter(x => x !== id) : [...p.dietGoals, id]
  }))
  const toggleAllergen = id => setProfile(p => ({
    ...p, allergens: p.allergens.includes(id) ? p.allergens.filter(x => x !== id) : [...p.allergens, id]
  }))
  const addCustom = () => {
    const val = allergenInput.trim()
    if (!val || profile.customAllergens.includes(val)) return
    setProfile(p => ({ ...p, customAllergens: [...p.customAllergens, val] }))
    setAllergenInput('')
  }
  const removeCustom = val => setProfile(p => ({ ...p, customAllergens: p.customAllergens.filter(x => x !== val) }))

  const activeCount = profile.dietGoals.length + profile.allergens.length + profile.customAllergens.length + (profile.halal ? 1 : 0)

  return (
    <div className="screen" style={{ paddingTop: 0, overflowX: 'hidden' }}>

      {/* ── HERO HEADER ─────────────────────────────────── */}
      <div style={{
        padding: '56px 24px 28px',
        background: 'linear-gradient(160deg, rgba(124,58,237,0.18) 0%, rgba(7,7,15,0) 70%)',
        borderBottom: '1px solid var(--border)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow orb behind logo */}
        <div style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo + wordmark stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, position: 'relative' }}>
          <img
            src="/logo.png"
            alt="Körset"
            style={{ height: 64, width: 64, objectFit: 'contain', filter: 'drop-shadow(0 0 16px rgba(139,92,246,0.5))' }}
          />
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px',
              background: 'linear-gradient(135deg, #E9D5FF 0%, #A78BFA 50%, #7C3AED 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              lineHeight: 1.1,
            }}>Körset</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 5, letterSpacing: '0.3px' }}>
              Умный помощник покупателя
            </div>
          </div>
        </div>

        {/* Subtitle */}
        <p style={{
          color: 'var(--text-sub)', fontSize: 13, lineHeight: 1.7,
          textAlign: 'center', marginTop: 16, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto',
        }}>
          Настройте профиль — AI мгновенно покажет<br/>подходит ли товар именно вам
        </p>
      </div>

      {/* ── HALAL TOGGLE ────────────────────────────────── */}
      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
          Религиозные требования
        </div>
        <div
          onClick={() => setProfile(p => ({ ...p, halal: !p.halal }))}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: profile.halal ? 'var(--primary-dim)' : 'var(--card)',
            border: `1.5px solid ${profile.halal ? 'var(--primary-mid)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>☪️</span>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                Только Халал
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                Исключит товары без маркировки
              </div>
            </div>
          </div>
          {/* Toggle */}
          <div style={{
            width: 48, height: 28, borderRadius: 14,
            background: profile.halal ? 'var(--primary)' : 'var(--border-bright)',
            position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            boxShadow: profile.halal ? '0 0 12px var(--primary-glow)' : 'none',
          }}>
            <span style={{
              position: 'absolute', width: 22, height: 22, borderRadius: '50%',
              background: 'white', top: 3,
              left: profile.halal ? 23 : 3,
              transition: 'left 0.2s cubic-bezier(0.34,1.3,0.64,1)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>
      </div>

      {/* ── DIET GOALS ──────────────────────────────────── */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Диета и предпочтения
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', opacity: 0.7, marginTop: 4 }}>
            Нажмите всё что подходит
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {DIET_GOALS.map(d => {
            const active = profile.dietGoals.includes(d.id)
            return (
              <button
                key={d.id}
                onClick={() => toggleDiet(d.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', borderRadius: 14,
                  border: `1.5px solid ${active ? 'var(--primary-mid)' : 'var(--border)'}`,
                  background: active ? 'var(--primary-dim)' : 'var(--card)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  transition: 'all 0.15s', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{d.emoji}</span>
                <span style={{
                  fontSize: 13, fontWeight: 500, lineHeight: 1.3,
                  color: active ? 'var(--primary-bright)' : 'var(--text-sub)',
                }}>{d.label}</span>
                {active && (
                  <span style={{
                    marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--primary)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 11, color: 'white', flexShrink: 0,
                  }}>✓</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── ALLERGENS ───────────────────────────────────── */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Мои аллергены
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', opacity: 0.7, marginTop: 4 }}>
            Товары с этими ингредиентами будут помечены ⚠️
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {ALLERGENS.map(a => {
            const active = profile.allergens.includes(a.id)
            return (
              <button
                key={a.id}
                onClick={() => toggleAllergen(a.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  padding: '12px 8px', borderRadius: 14,
                  border: `1.5px solid ${active ? 'rgba(239,68,68,0.6)' : 'var(--border)'}`,
                  background: active ? 'rgba(239,68,68,0.1)' : 'var(--card)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  transition: 'all 0.15s', position: 'relative',
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{a.emoji}</span>
                <span style={{
                  fontSize: 11, fontWeight: 500, textAlign: 'center', lineHeight: 1.2,
                  color: active ? '#F87171' : 'var(--text-dim)',
                }}>{a.label}</span>
                {active && (
                  <div style={{
                    position: 'absolute', top: -5, right: -5,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#EF4444', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 9, color: 'white', fontWeight: 700,
                  }}>✕</div>
                )}
              </button>
            )
          })}
        </div>

        {/* Custom input */}
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            Не нашли свой аллерген? Добавьте вручную
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={allergenInputRef}
              value={allergenInput}
              onChange={e => setAllergenInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="Например: клубника, кунжут..."
              style={{
                flex: 1, background: 'var(--surface)', border: '1px solid var(--border-bright)',
                borderRadius: 10, padding: '9px 12px', color: 'var(--text)',
                fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none',
              }}
            />
            <button
              onClick={addCustom}
              style={{
                padding: '9px 14px', borderRadius: 10, background: 'var(--primary-dim)',
                border: '1px solid rgba(139,92,246,0.3)', color: 'var(--primary-bright)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)',
                whiteSpace: 'nowrap',
              }}
            >+ Добавить</button>
          </div>
          {profile.customAllergens.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {profile.customAllergens.map(val => (
                <span key={val} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 20, fontSize: 12,
                  background: 'rgba(239,68,68,0.1)', color: '#F87171',
                  border: '1px solid rgba(239,68,68,0.25)',
                }}>
                  ⚠️ {val}
                  <span onClick={() => removeCustom(val)} style={{ cursor: 'pointer', opacity: 0.7, fontSize: 14 }}>×</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── PRIORITY ────────────────────────────────────── */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
          Приоритет выбора
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {PRIORITIES.map(p => {
            const active = profile.priority === p.id
            return (
              <button
                key={p.id}
                onClick={() => setProfile(prev => ({ ...prev, priority: p.id }))}
                style={{
                  padding: '16px 8px', borderRadius: 16,
                  border: `1.5px solid ${active ? 'var(--primary-mid)' : 'var(--border)'}`,
                  background: active ? 'var(--primary-dim)' : 'var(--card)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  transition: 'all 0.15s', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 8,
                  boxShadow: active ? '0 0 16px rgba(124,58,237,0.15)' : 'none',
                }}
              >
                <span style={{ fontSize: 28, lineHeight: 1 }}>{p.emoji}</span>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                    color: active ? 'var(--primary-bright)' : 'var(--text)',
                    textAlign: 'center',
                  }}>{p.label}</div>
                  <div style={{
                    fontSize: 11, color: 'var(--text-dim)', marginTop: 3,
                    lineHeight: 1.3, textAlign: 'center',
                  }}>{p.desc}</div>
                </div>
                {active && (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--primary)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: 'white',
                  }}>✓</div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── ACTIVE SUMMARY ──────────────────────────────── */}
      {activeCount > 0 && (
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '10px 14px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)' }}>
                Активных фильтров: {activeCount}
              </span>
              <button
                onClick={() => setProfile({ halal: false, dietGoals: [], allergens: [], customAllergens: [], priority: 'balanced' })}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                Сбросить всё
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {profile.halal && <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--primary-dim)', color: 'var(--primary-bright)', border: '1px solid rgba(139,92,246,0.2)' }}>☪️ Халал</span>}
              {profile.dietGoals.map(id => {
                const d = DIET_GOALS.find(x => x.id === id)
                return <span key={id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--primary-dim)', color: 'var(--primary-bright)', border: '1px solid rgba(139,92,246,0.2)' }}>{d?.emoji} {d?.label}</span>
              })}
              {profile.allergens.map(id => {
                const a = ALLERGENS.find(x => x.id === id)
                return <span key={id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>⚠️ {a?.label}</span>
              })}
              {profile.customAllergens.map(val => (
                <span key={val} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>⚠️ {val}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CTA BUTTONS ─────────────────────────────────── */}
      <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn btn-primary btn-full" onClick={() => navigate('/catalog')}>
          {activeCount > 0 && (
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '2px 9px', fontSize: 12, fontWeight: 700 }}>
              {activeCount}
            </span>
          )}
          Показать подходящие товары →
        </button>
        <button className="btn btn-secondary btn-full" onClick={() => navigate('/scan')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/>
            <rect x="3" y="16" width="5" height="5" rx="1"/>
            <path d="M16 16h5v5M16 16v5M3 12h4M10 3v4M12 10h7M10 16v5"/>
          </svg>
          Сканировать QR-код
        </button>
        <div style={{ textAlign: 'center', paddingTop: 4 }}>
          <span onClick={() => navigate('/qr-print')} style={{ fontSize: 11, color: 'var(--text-dim)', opacity: 0.2, cursor: 'pointer' }}>
            v1.0
          </span>
        </div>
      </div>

    </div>
  )
}
