import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadProfile, saveProfile } from '../utils/profile.js'

const DIET_GOALS = [
  { id: 'sugar_free',  label: 'Без сахара',    icon: 'nosugar'  },
  { id: 'dairy_free',  label: 'Без молочки',   icon: 'nodairy'  },
  { id: 'gluten_free', label: 'Без глютена',   icon: 'nogluten' },
  { id: 'vegan',       label: 'Веган',         icon: 'vegan'    },
  { id: 'vegetarian',  label: 'Вегетарианец',  icon: 'veggie'   },
  { id: 'keto',        label: 'Кето',          icon: 'keto'     },
  { id: 'low_calorie', label: 'Меньше калорий',icon: 'lowcal'   },
]

const ALLERGENS = [
  { id: 'milk',      label: 'Молоко',   icon: 'milk'     },
  { id: 'gluten',    label: 'Глютен',   icon: 'wheat'    },
  { id: 'nuts',      label: 'Орехи',    icon: 'nuts'     },
  { id: 'peanuts',   label: 'Арахис',   icon: 'peanut'   },
  { id: 'soy',       label: 'Соя',      icon: 'soy'      },
  { id: 'eggs',      label: 'Яйца',     icon: 'egg'      },
  { id: 'fish',      label: 'Рыба',     icon: 'fish'     },
  { id: 'shellfish', label: 'Моллюски', icon: 'shell'    },
]

const PRIORITIES = [
  { id: 'price',    label: 'Цена',     desc: 'Самый дешёвый',   icon: 'price'   },
  { id: 'balanced', label: 'Баланс',   desc: 'Цена + качество', icon: 'balance' },
  { id: 'quality',  label: 'Качество', desc: 'Лучший состав',   icon: 'quality' },
]

// All custom SVG icons — no emoji
function Icon({ name, size = 20, color = 'currentColor' }) {
  const s = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'nosugar': return <svg {...s}><circle cx="12" cy="12" r="9"/><path d="M9 9c0-1.7 1.3-3 3-3s3 1.3 3 3c0 3-3 3-3 6"/><circle cx="12" cy="19" r=".5" fill={color} stroke="none"/><line x1="4" y1="4" x2="20" y2="20"/></svg>
    case 'nodairy': return <svg {...s}><path d="M8 3h8l1 3v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6l1-3z"/><path d="M9 6h6"/><line x1="4" y1="4" x2="20" y2="20"/></svg>
    case 'nogluten': return <svg {...s}><path d="M12 2v20M8 6c1.5.5 2.5.5 4 0s2.5-.5 4 0M8 10c1.5.5 2.5.5 4 0s2.5-.5 4 0M8 14c1.5.5 2.5.5 4 0s2.5-.5 4 0"/><line x1="4" y1="4" x2="20" y2="20"/></svg>
    case 'vegan': return <svg {...s}><path d="M2 22c3-8 8-14 20-14-1 12-8 18-20 14z"/><path d="M6 18c2-4 5-7 10-9"/></svg>
    case 'veggie': return <svg {...s}><path d="M12 22s-8-4-8-12c0-4 3-7 8-8 5 1 8 4 8 8 0 8-8 12-8 12z"/><path d="M12 8v6M9 11h6"/></svg>
    case 'keto': return <svg {...s}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    case 'lowcal': return <svg {...s}><path d="M12 2a5 5 0 0 1 5 5c0 5-5 11-5 11S7 12 7 7a5 5 0 0 1 5-5z"/><circle cx="12" cy="7" r="1.5" fill={color} stroke="none"/><path d="M5 21h14"/></svg>
    // allergens
    case 'milk': return <svg {...s}><path d="M8 3h8l1 3v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6l1-3z"/><path d="M9 6h6"/><path d="M9 12c1 1 5 1 6 0"/></svg>
    case 'wheat': return <svg {...s}><path d="M12 2v20M8 6c1.5.5 2.5.5 4 0s2.5-.5 4 0M8 10c1.5.5 2.5.5 4 0s2.5-.5 4 0M8 14c1.5.5 2.5.5 4 0s2.5-.5 4 0"/></svg>
    case 'nuts': return <svg {...s}><path d="M12 3c4 0 7 2.5 7 6s-2 7-7 9c-5-2-7-5.5-7-9s3-6 7-6z"/><path d="M12 3v3M9 6h6"/></svg>
    case 'peanut': return <svg {...s}><path d="M9 3c-3 0-5 2-5 4.5S5.5 12 9 12h6c3.5 0 5-2 5-4.5S18.5 3 15 3H9z"/><path d="M12 12v9M9 17h6"/></svg>
    case 'soy': return <svg {...s}><circle cx="12" cy="12" r="3"/><path d="M12 2c0 4-3 7-7 8 4 1 7 4 7 8 0-4 3-7 7-8-4-1-7-4-7-8z"/></svg>
    case 'egg': return <svg {...s}><path d="M12 3C9 3 6 7 6 12c0 3.3 2.7 6 6 6s6-2.7 6-6c0-5-3-9-6-9z"/><path d="M9.5 13.5c.5 1 1.5 1.5 2.5 1.5"/></svg>
    case 'fish': return <svg {...s}><path d="M6.5 12c0 0-4-4-4-6.5s3-3 5 0l1.5 2.5L11 9c2-3 5-5 9-5-1 4-3 7-6 9 3 2 5 5 6 9-4 0-7-2-9-5l-2 1.5-1.5 2.5c-2 3-5 2.5-5 0S6.5 12 6.5 12z"/><circle cx="17" cy="8" r="1" fill={color} stroke="none"/></svg>
    case 'shell': return <svg {...s}><path d="M12 22c-4-2-8-6-8-11a8 8 0 0 1 16 0c0 5-4 9-8 11z"/><path d="M12 22V11M8 14l4-3 4 3"/></svg>
    // priorities
    case 'price': return <svg {...s}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    case 'balance': return <svg {...s}><path d="M12 3v18M5 7h14M7 7l-3 5h6l-3-5zM17 7l-3 5h6l-3-5z"/></svg>
    case 'quality': return <svg {...s}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    default: return null
  }
}

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

  useEffect(() => { saveProfile({ ...profile, presetId: 'custom' }) }, [profile])

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

      {/* ── HERO ── */}
      <div style={{
        padding: '52px 24px 24px',
        background: 'linear-gradient(160deg, rgba(124,58,237,0.15) 0%, transparent 65%)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <div style={{
            position: 'absolute', inset: -20,
            background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}/>
          <img src="/logo.png" alt="Körset"
            style={{ height: 72, width: 72, objectFit: 'contain', position: 'relative',
              filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.6))' }}
          />
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.7, textAlign: 'center', maxWidth: 260, marginTop: 4 }}>
          Настройте профиль — AI мгновенно покажет подходит ли товар вам
        </p>
      </div>

      {/* ── HALAL ── */}
      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 10 }}>
          Религиозные требования
        </div>
        <div onClick={() => setProfile(p => ({ ...p, halal: !p.halal }))} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: profile.halal ? 'rgba(124,58,237,0.1)' : 'var(--card)',
          border: `1.5px solid ${profile.halal ? 'var(--primary-mid)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer', transition: 'all 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12,
              background: profile.halal ? 'var(--primary-dim)' : 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={profile.halal ? 'var(--primary-bright)' : 'var(--text-dim)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.2A8.5 8.5 0 1 1 11.8 3a7 7 0 1 0 9.2 9.2Z"/>
                <path d="M16.5 7.5l.6 1.6 1.7.1-1.3 1 .5 1.7-1.5-.9-1.5.9.5-1.7-1.3-1 1.7-.1.6-1.6Z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Только Халал</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 1 }}>Исключит товары без маркировки</div>
            </div>
          </div>
          <div style={{ width: 46, height: 26, borderRadius: 13,
            background: profile.halal ? 'var(--primary)' : 'var(--border-bright)',
            position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            boxShadow: profile.halal ? '0 0 10px var(--primary-glow)' : 'none' }}>
            <span style={{ position: 'absolute', width: 20, height: 20, borderRadius: '50%',
              background: 'white', top: 3, left: profile.halal ? 23 : 3,
              transition: 'left 0.2s cubic-bezier(0.34,1.3,0.64,1)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
          </div>
        </div>
      </div>

      {/* ── DIET ── */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.2px' }}>Диета и предпочтения</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', opacity: 0.6, marginTop: 3 }}>Нажмите всё что подходит</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {DIET_GOALS.map(d => {
            const active = profile.dietGoals.includes(d.id)
            return (
              <button key={d.id} onClick={() => toggleDiet(d.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                borderRadius: 14, border: `1.5px solid ${active ? 'var(--primary-mid)' : 'var(--border)'}`,
                background: active ? 'rgba(124,58,237,0.1)' : 'var(--card)',
                cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: active ? 'var(--primary-dim)' : 'var(--surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: active ? 'var(--primary-bright)' : 'var(--text-dim)' }}>
                  <Icon name={d.icon} size={16} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: active ? 'var(--primary-bright)' : 'var(--text-sub)', lineHeight: 1.3 }}>
                  {d.label}
                </span>
                {active && <div style={{ marginLeft: 'auto', width: 16, height: 16, borderRadius: '50%',
                  background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 10, color: 'white' }}>✓</div>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── ALLERGENS ── */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.2px' }}>Мои аллергены</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', opacity: 0.6, marginTop: 3 }}>Товары с этим составом будут помечены ⚠️</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {ALLERGENS.map(a => {
            const active = profile.allergens.includes(a.id)
            return (
              <button key={a.id} onClick={() => toggleAllergen(a.id)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                padding: '12px 6px', borderRadius: 14, position: 'relative',
                border: `1.5px solid ${active ? 'rgba(239,68,68,0.55)' : 'var(--border)'}`,
                background: active ? 'rgba(239,68,68,0.08)' : 'var(--card)',
                cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 10,
                  background: active ? 'rgba(239,68,68,0.12)' : 'var(--surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: active ? '#F87171' : 'var(--text-dim)' }}>
                  <Icon name={a.icon} size={17} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, textAlign: 'center', lineHeight: 1.2,
                  color: active ? '#F87171' : 'var(--text-dim)' }}>{a.label}</span>
                {active && <div style={{ position: 'absolute', top: -5, right: -5,
                  width: 16, height: 16, borderRadius: '50%', background: '#EF4444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: 'white', fontWeight: 800 }}>✕</div>}
              </button>
            )
          })}
        </div>

        {/* Custom input */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Не нашли? Введите вручную</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={allergenInputRef} value={allergenInput}
              onChange={e => setAllergenInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="Клубника, кунжут..."
              style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border-bright)',
                borderRadius: 10, padding: '9px 12px', color: 'var(--text)',
                fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }}
            />
            <button onClick={addCustom} style={{ padding: '9px 14px', borderRadius: 10,
              background: 'var(--primary-dim)', border: '1px solid rgba(139,92,246,0.3)',
              color: 'var(--primary-bright)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
              + Добавить
            </button>
          </div>
          {profile.customAllergens.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {profile.customAllergens.map(val => (
                <span key={val} style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 20, fontSize: 12,
                  background: 'rgba(239,68,68,0.1)', color: '#F87171',
                  border: '1px solid rgba(239,68,68,0.25)' }}>
                  ⚠️ {val}
                  <span onClick={() => removeCustom(val)} style={{ cursor: 'pointer', opacity: 0.7, fontSize: 15 }}>×</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── PRIORITY ── */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 12 }}>
          Приоритет выбора
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {PRIORITIES.map(p => {
            const active = profile.priority === p.id
            return (
              <button key={p.id} onClick={() => setProfile(prev => ({ ...prev, priority: p.id }))} style={{
                padding: '16px 8px', borderRadius: 16, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--primary-mid)' : 'var(--border)'}`,
                background: active ? 'rgba(124,58,237,0.1)' : 'var(--card)',
                fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                boxShadow: active ? '0 0 18px rgba(124,58,237,0.12)' : 'none',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 14,
                  background: active ? 'var(--primary-dim)' : 'var(--surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: active ? 'var(--primary-bright)' : 'var(--text-dim)',
                  transition: 'all 0.15s' }}>
                  <Icon name={p.icon} size={22} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
                    color: active ? 'var(--primary-bright)' : 'var(--text)' }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3, lineHeight: 1.3 }}>{p.desc}</div>
                </div>
                {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── SUMMARY ── */}
      {activeCount > 0 && (
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sub)' }}>Активных фильтров: {activeCount}</span>
              <button onClick={() => setProfile({ halal: false, dietGoals: [], allergens: [], customAllergens: [], priority: 'balanced' })}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Сбросить
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {profile.halal && <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--primary-dim)', color: 'var(--primary-bright)', border: '1px solid rgba(139,92,246,0.2)' }}>Халал</span>}
              {profile.dietGoals.map(id => {
                const d = DIET_GOALS.find(x => x.id === id)
                return <span key={id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--primary-dim)', color: 'var(--primary-bright)', border: '1px solid rgba(139,92,246,0.2)' }}>{d?.label}</span>
              })}
              {profile.allergens.map(id => {
                const a = ALLERGENS.find(x => x.id === id)
                return <span key={id} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>{a?.label}</span>
              })}
              {profile.customAllergens.map(val => (
                <span key={val} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.2)' }}>{val}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CTA ── */}
      <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn btn-primary btn-full" onClick={() => navigate('/catalog')}
          style={{ justifyContent: 'center', gap: 12 }}>
          <span>Показать подходящие товары</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
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
          <span onClick={() => navigate('/qr-print')} style={{ fontSize: 11, color: 'var(--text-dim)', opacity: 0.2, cursor: 'pointer' }}>v1.0</span>
        </div>
      </div>
    </div>
  )
}
