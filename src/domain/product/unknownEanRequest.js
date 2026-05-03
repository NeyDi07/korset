const VALID_REQUEST_EAN = /^\d{8}$|^\d{13}$/

const COPY = {
  ru: {
    title: 'Товар не найден',
    body: 'Körset пока не нашёл этот товар. Мы также не поддерживаем алкогольную и табачную продукцию, поэтому для таких товаров Fit-Check недоступен. Если это обычный продукт питания, отправьте запрос — мы проверим и добавим его.',
    requestButton: 'Отправить запрос',
    requested: 'Запрос отправлен',
    requestFailed: 'Не удалось отправить запрос',
    scanAnother: 'Сканировать другой товар',
  },
  kz: {
    title: 'Тауар табылмады',
    body: 'Körset бұл тауарды әзірге таппады. Біз алкоголь және темекі өнімдерін қолдамаймыз, сондықтан мұндай тауарларға Fit-Check қолжетімсіз. Егер бұл кәдімгі азық-түлік өнімі болса, сұрау жіберіңіз — біз тексеріп, қосамыз.',
    requestButton: 'Сұрау жіберу',
    requested: 'Сұрау жіберілді',
    requestFailed: 'Сұрау жіберу мүмкін болмады',
    scanAnother: 'Басқа тауарды сканерлеу',
  },
}

export function canRequestUnknownProduct({ ean, storeId }) {
  return Boolean(storeId && VALID_REQUEST_EAN.test(String(ean || '').trim()))
}

export function getUnknownProductRequestCopy(lang = 'ru') {
  return COPY[lang] || COPY.ru
}

export async function requestUnknownProductCheck({ ean, storeId, client }) {
  const normalizedEan = String(ean || '').trim()
  if (!client || !canRequestUnknownProduct({ ean: normalizedEan, storeId })) {
    return { ok: false, reason: 'invalid_request' }
  }

  try {
    const { error } = await client.rpc('increment_missing_scan_count', {
      p_ean: normalizedEan,
      p_store_id: storeId,
    })
    if (error) return { ok: false, reason: 'rpc_error' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'network_error' }
  }
}
