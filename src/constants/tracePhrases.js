// Фразы для обнаружения "следов" аллергенов в ingredients_raw
// Оранжевый уровень (WARNING): пользователь решает сам
// Источник: ТР ТС 022/2011, практика маркировки ЕАЭС

// Все фразы — lowercase, ищутся как подстроки в ingredients_raw.toLowerCase()
export const TRACE_PHRASES_RU = [
  'может содержать следы',
  'может содержать незначительное количество',
  'возможно наличие следов',
  'возможно содержание следов',
  'произведено на предприятии, где используется',
  'произведено на оборудовании, где',
  'изготовлено на линии, где',
  'на производстве используется',
  'не исключено наличие',
  'возможно присутствие',
  'содержит следы',
]

export const TRACE_PHRASES_EN = [
  'may contain traces',
  'may contain',
  'produced in a facility',
  'manufactured on equipment',
  'processed in a plant',
  'traces of',
  'made on shared equipment',
]

export const ALL_TRACE_PHRASES = [...TRACE_PHRASES_RU, ...TRACE_PHRASES_EN]

/**
 * Проверяет, содержит ли текст ингредиентов предупреждения о следах.
 * Возвращает массив обнаруженных фраз-предупреждений.
 */
export function detectTraces(ingredientsRaw) {
  if (!ingredientsRaw) return []
  const lower = ingredientsRaw.toLowerCase()
  return ALL_TRACE_PHRASES.filter((phrase) => lower.includes(phrase))
}

/**
 * Извлекает из текста конкретные аллергены, упомянутые в контексте "следов".
 * Например: "может содержать следы арахиса и молока" → ['арахис', 'молока']
 * Для V1 возвращаем только сам факт наличия фразы.
 */
export function extractTraceAllergens(ingredientsRaw, allergenSynonyms) {
  if (!ingredientsRaw) return []
  const lower = ingredientsRaw.toLowerCase()

  // Ищем текст после фразы-маркера
  const results = []
  for (const phrase of ALL_TRACE_PHRASES) {
    const idx = lower.indexOf(phrase)
    if (idx === -1) continue

    // Берём 100 символов после фразы для анализа
    const afterPhrase = lower.substring(idx + phrase.length, idx + phrase.length + 100)

    // Проверяем каждый аллерген
    for (const [allergenId, synonyms] of Object.entries(allergenSynonyms)) {
      for (const synonym of synonyms) {
        if (afterPhrase.includes(synonym)) {
          results.push({ allergenId, matchedPhrase: phrase, matchedSynonym: synonym })
          break // один матч на аллерген достаточно
        }
      }
    }
  }

  return results
}
