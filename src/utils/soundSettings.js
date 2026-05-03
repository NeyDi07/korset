export const DEFAULT_SOUND_SETTINGS = {
  sound: true,
  vibration: true,
}

export function loadSoundSettings() {
  try {
    const raw = localStorage.getItem('korset_sound_settings')
    if (raw) {
      return { ...DEFAULT_SOUND_SETTINGS, ...JSON.parse(raw) }
    }
  } catch (err) {
    // noop
  }
  return DEFAULT_SOUND_SETTINGS
}

export function saveSoundSettings(settings) {
  try {
    localStorage.setItem('korset_sound_settings', JSON.stringify(settings))
  } catch (err) {
    // noop
  }
}
