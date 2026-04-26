// Banner presets for ProfileScreen background card.
// Stored as `preset:<id>` in users.banner_url. URLs are public assets in /public/banners/.

export const BANNER_PRESETS = [
  /* ── New photo banners (WebP, 1200×450, optimized) ── */
  {
    id: 'golden-samurai',
    src: '/banners/golden-samurai.webp',
    thumb: '/banners/thumbs/golden-samurai.webp',
    label: { ru: 'Золотой закат', kz: 'Алтын күн батуы' },
  },
  {
    id: 'starlit-observatory',
    src: '/banners/starlit-observatory.webp',
    thumb: '/banners/thumbs/starlit-observatory.webp',
    label: { ru: 'Звёздная ночь', kz: 'Жұлдызды түн' },
  },
  {
    id: 'witching-hour',
    src: '/banners/witching-hour.webp',
    thumb: '/banners/thumbs/witching-hour.webp',
    label: { ru: 'Ведьмин час', kz: 'Сиқыршы сағаты' },
  },
  {
    id: 'teal-moonlight',
    src: '/banners/teal-moonlight.webp',
    thumb: '/banners/thumbs/teal-moonlight.webp',
    label: { ru: 'Бирюзовая луна', kz: 'Көкжасын ай' },
  },
  {
    id: 'crescent-nightingale',
    src: '/banners/crescent-nightingale.webp',
    thumb: '/banners/thumbs/crescent-nightingale.webp',
    label: { ru: 'Полумесяц', kz: 'Жарты ай' },
  },
  {
    id: 'dawn-ronin',
    src: '/banners/dawn-ronin.webp',
    thumb: '/banners/thumbs/dawn-ronin.webp',
    label: { ru: 'Рассветный ронин', kz: 'Таңғы ронин' },
  },
  /* ── Placeholders for next batch (drop images + run optimize:banners) ── */
  {
    id: 'midnight-grove',
    src: '/banners/midnight-grove.webp',
    thumb: '/banners/thumbs/midnight-grove.webp',
    label: { ru: 'Полночная роща', kz: 'Түнгі орман' },
  },
  {
    id: 'astral-dream',
    src: '/banners/astral-dream.webp',
    thumb: '/banners/thumbs/astral-dream.webp',
    label: { ru: 'Астральный сон', kz: 'Астралдық түс' },
  },
  {
    id: 'ember-field',
    src: '/banners/ember-field.webp',
    thumb: '/banners/thumbs/ember-field.webp',
    label: { ru: 'Поле углей', kz: 'Қызыл өріс' },
  },
  /* ── Legacy vector banners (kept for old user profiles) ── */
  {
    id: 'sunset',
    src: '/banners/sunset.svg',
    label: { ru: 'Закат', kz: 'Күн батуы' },
  },
  {
    id: 'mountains',
    src: '/banners/mountains.svg',
    label: { ru: 'Горы', kz: 'Таулар' },
  },
  {
    id: 'purple',
    src: '/banners/purple.svg',
    label: { ru: 'Космос', kz: 'Ғарыш' },
  },
  {
    id: 'forest',
    src: '/banners/forest.svg',
    label: { ru: 'Лес', kz: 'Орман' },
  },
  {
    id: 'ocean',
    src: '/banners/ocean.svg',
    label: { ru: 'Океан', kz: 'Мұхит' },
  },
]

export const DEFAULT_BANNER_ID = 'golden-samurai'

/**
 * Resolve a stored banner value (preset id or full URL) to an image src.
 * @param {string|null|undefined} value - either `preset:<id>`, plain `<id>`, full URL, or null.
 * @returns {string} resolved image URL (falls back to default preset).
 */
export function resolveBannerSrc(value) {
  if (!value) return getPresetSrc(DEFAULT_BANNER_ID)
  if (/^https?:\/\//i.test(value)) return value
  const id = value.startsWith('preset:') ? value.slice(7) : value
  return getPresetSrc(id)
}

function getPresetSrc(id) {
  const found = BANNER_PRESETS.find((p) => p.id === id)
  return found ? found.src : BANNER_PRESETS[0].src
}
