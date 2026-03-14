const STORAGE_KEY = 'korset_profile'

export const DEFAULT_PROFILE = {
  presetId: null,
  halal: false,
  halalOnly: false,
  allergens: [],
  customAllergens: [],
  dietGoals: [],
  sugarFree: false,
  priority: 'balanced',
}

export const ALLERGEN_OPTIONS = [
  { id: 'milk', label: 'Молоко' },
  { id: 'eggs', label: 'Яйца' },
  { id: 'gluten', label: 'Глютен' },
  { id: 'nuts', label: 'Орехи' },
  { id: 'peanuts', label: 'Арахис' },
  { id: 'soy', label: 'Соя' },
  { id: 'fish', label: 'Рыба' },
  { id: 'shellfish', label: 'Морепродукты' },
  { id: 'sesame', label: 'Кунжут' },
  { id: 'honey', label: 'Мёд' },
]

export const ALLERGEN_NAMES = {
  milk: 'Молоко',
  eggs: 'Яйца',
  gluten: 'Глютен',
  nuts: 'Орехи',
  peanuts: 'Арахис',
  soy: 'Соя',
  fish: 'Рыба',
  shellfish: 'Морепродукты',
  sesame: 'Кунжут',
  honey: 'Мёд',
  wheat: 'Пшеница',
}

export function loadProfile() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        ...DEFAULT_PROFILE,
        ...parsed,
        halal: Boolean(parsed.halal || parsed.halalOnly),
        halalOnly: Boolean(parsed.halal || parsed.halalOnly),
        allergens: Array.isArray(parsed.allergens) ? parsed.allergens : [],
        customAllergens: Array.isArray(parsed.customAllergens) ? parsed.customAllergens : [],
        dietGoals: Array.isArray(parsed.dietGoals) ? parsed.dietGoals : [],
      }
    }
  } catch {}
  return { ...DEFAULT_PROFILE }
}

export function saveProfile(profile) {
  try {
    const normalized = {
      ...DEFAULT_PROFILE,
      ...profile,
      halal: Boolean(profile.halal || profile.halalOnly),
      halalOnly: Boolean(profile.halal || profile.halalOnly),
      sugarFree: Boolean(profile.sugarFree || (profile.dietGoals || []).includes('sugar_free')),
      allergens: Array.isArray(profile.allergens) ? [...new Set(profile.allergens)] : [],
      customAllergens: Array.isArray(profile.customAllergens) ? [...new Set(profile.customAllergens)] : [],
      dietGoals: Array.isArray(profile.dietGoals) ? [...new Set(profile.dietGoals)] : [],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  } catch {}
}

export function applyPreset(presetId) {
  const presets = {
    halal: { ...DEFAULT_PROFILE, presetId, halal: true, halalOnly: true },
    sugar_free: { ...DEFAULT_PROFILE, presetId, dietGoals: ['sugar_free'], sugarFree: true },
    dairy_free: { ...DEFAULT_PROFILE, presetId, dietGoals: ['dairy_free'], allergens: ['milk'] },
  }
  return presets[presetId] || { ...DEFAULT_PROFILE }
}
