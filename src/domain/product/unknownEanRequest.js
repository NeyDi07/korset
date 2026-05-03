const VALID_REQUEST_EAN = /^\d{8}$|^\d{13}$/

export function canRequestUnknownProduct({ ean, storeId }) {
  return Boolean(storeId && VALID_REQUEST_EAN.test(String(ean || '').trim()))
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
