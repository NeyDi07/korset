// Banner presets for ProfileScreen background card.
// Stored as `preset:<id>` in users.banner_url. URLs are public assets in /public/banners/.

export const BANNER_PRESETS = [
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

export const DEFAULT_BANNER_ID = 'sunset'

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
