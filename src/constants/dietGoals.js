// Единый источник данных о диетических целях
// Используется в: ProfileScreen, OnboardingScreen

export const DIET_GOALS = [
  { id: 'sugar_free', label: { ru: 'Без сахара', kz: 'Қантсыз' }, icon: 'nosugar' },
  { id: 'dairy_free', label: { ru: 'Без лактозы', kz: 'Лактозасыз' }, icon: 'nodairy' },
  { id: 'gluten_free', label: { ru: 'Без глютена', kz: 'Глютенсіз' }, icon: 'nogluten' },
  { id: 'vegan', label: { ru: 'Веган', kz: 'Веган' }, icon: 'vegan' },
  { id: 'vegetarian', label: { ru: 'Вегетариан', kz: 'Вегетариан' }, icon: 'veggie' },
  { id: 'keto', label: { ru: 'Кето', kz: 'Кето' }, icon: 'keto' },
  { id: 'kid_friendly', label: { ru: 'Для детей', kz: 'Балаларға' }, icon: 'kids' },
]

// Приоритеты покупок
export const PRIORITIES = [
  {
    id: 'price',
    label: { ru: 'Цена', kz: 'Баға' },
    desc: { ru: 'Ең арзан', kz: 'Ең арзан' },
    icon: 'price',
  },
  {
    id: 'balanced',
    label: { ru: 'Баланс', kz: 'Теңгерім' },
    desc: { ru: 'Цена + качество', kz: 'Баға + сапа' },
    icon: 'balance',
  },
  {
    id: 'quality',
    label: { ru: 'Качество', kz: 'Сапа' },
    desc: { ru: 'Лучший состав', kz: 'Ең жақсы құрам' },
    icon: 'quality',
  },
]

// Preferences для Onboarding (включает halal)
export const ONBOARDING_PREFERENCES = [
  { id: 'halal', icon: 'halal', label: { ru: 'Халал', kz: 'Халал' } },
  { id: 'sugar_free', icon: 'nosugar', label: { ru: 'Без сахара', kz: 'Қантсыз' } },
  { id: 'dairy_free', icon: 'nodairy', label: { ru: 'Без лактозы', kz: 'Лактозасыз' } },
  { id: 'gluten_free', icon: 'nogluten', label: { ru: 'Без глютена', kz: 'Глютенсіз' } },
  { id: 'vegan', icon: 'vegan', label: { ru: 'Веган', kz: 'Веган' } },
  { id: 'vegetarian', icon: 'veggie', label: { ru: 'Вегетариан', kz: 'Вегетариан' } },
  { id: 'keto', icon: 'keto', label: { ru: 'Кето', kz: 'Кето' } },
  { id: 'kid_friendly', icon: 'kids', label: { ru: 'Для детей', kz: 'Балаларға' } },
]

// Layout rows для Onboarding
export const PREFERENCE_ROWS = [
  ['halal', 'sugar_free', 'dairy_free'],
  ['gluten_free', 'vegan', 'vegetarian'],
  ['keto', 'kid_friendly'],
]
