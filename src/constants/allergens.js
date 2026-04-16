// Единый источник данных об аллергенах
// Используется в: ProfileScreen, OnboardingScreen, fitCheck, ExternalProductScreen

export const ALLERGENS = [
  { id: 'milk', label: { ru: 'Молоко', kz: 'Сүт' }, icon: 'milk' },
  { id: 'eggs', label: { ru: 'Яйца', kz: 'Жұмыртқа' }, icon: 'egg' },
  { id: 'gluten', label: { ru: 'Глютен', kz: 'Глютен' }, icon: 'wheat' },
  { id: 'nuts', label: { ru: 'Орехи', kz: 'Жаңғақ' }, icon: 'nuts' },
  { id: 'peanuts', label: { ru: 'Арахис', kz: 'Жержаңғақ' }, icon: 'peanut' },
  { id: 'soy', label: { ru: 'Соя', kz: 'Соя' }, icon: 'soy' },
  { id: 'fish', label: { ru: 'Рыба', kz: 'Балық' }, icon: 'fish' },
  { id: 'shellfish', label: { ru: 'Морепродукты', kz: 'Теңіз өнімдері' }, icon: 'shell' },
  { id: 'sesame', label: { ru: 'Кунжут', kz: 'Күнжіт' }, icon: 'sesame' },
  { id: 'honey', label: { ru: 'Мёд', kz: 'Бал' }, icon: 'honey' },
]

// Маппинг id → русское название (для fitCheck, ExternalProductScreen)
export const ALLERGEN_NAMES = Object.fromEntries(ALLERGENS.map((a) => [a.id, a.label.ru]))

// Маппинг id → двуязычное название
export function getAllergenName(id, lang = 'ru') {
  const a = ALLERGENS.find((x) => x.id === id)
  return a ? a.label[lang] || a.label.ru : id
}

// Группировка для Onboarding layout
export const ALLERGEN_ROWS = [
  ['milk', 'eggs', 'gluten'],
  ['nuts', 'peanuts', 'soy'],
  ['fish', 'shellfish', 'sesame'],
]

// Маппинг Open Food Facts тегов → наш id
export const OFF_ALLERGEN_MAP = {
  'en:milk': 'milk',
  'en:gluten': 'gluten',
  'en:nuts': 'nuts',
  'en:peanuts': 'peanuts',
  'en:soybeans': 'soy',
  'en:eggs': 'eggs',
  'en:fish': 'fish',
  'en:crustaceans': 'shellfish',
  'en:wheat': 'gluten',
  'en:sesame-seeds': 'sesame',
  'en:celery': 'celery',
  'en:mustard': 'mustard',
}
