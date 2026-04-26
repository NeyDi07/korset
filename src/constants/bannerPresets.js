// Banner presets for ProfileScreen background card.
// Stored as `preset:<id>` in users.banner_url. URLs are public assets in /public/banners/.

export const BANNER_PRESETS = [
  /* ── Photo banners (WebP, 1200×450, optimized via optimize:banners) ── */
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
  {
    id: 'midnight-grove',
    src: '/banners/midnight-grove.webp',
    thumb: '/banners/thumbs/midnight-grove.webp',
    label: { ru: 'Полночная роща', kz: 'Түнгі орман' },
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
