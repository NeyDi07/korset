import { supabase } from './supabase.js'

export const SCAN_HISTORY_STORAGE_KEY = 'korset_scan_history_cache_v2'

function readRawHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(SCAN_HISTORY_STORAGE_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function writeRawHistory(items) {
  try {
    localStorage.setItem(SCAN_HISTORY_STORAGE_KEY, JSON.stringify(items))
  } catch {}
}

export function buildHistoryOwnerKey(user) {
  return user?.id ? `user:${user.id}` : 'guest'
}

export async function getCurrentHistoryOwnerKey() {
  try {
    const { data } = await supabase.auth.getUser()
    return buildHistoryOwnerKey(data?.user || null)
  } catch {
    return 'guest'
  }
}

export function readLocalScanHistory(ownerKey = 'guest') {
  return readRawHistory().filter((item) => item && item.ownerKey === ownerKey)
}

export function writeLocalScanHistory(ownerKey, nextList) {
  const list = readRawHistory()
  const foreign = list.filter((item) => item?.ownerKey !== ownerKey)
  writeRawHistory([...foreign, ...nextList])
}

export function appendLocalScanHistory(ownerKey, entry, limit = 50) {
  if (!entry?.ean) return
  const scoped = readLocalScanHistory(ownerKey).filter((item) => item?.ean !== entry.ean)
  const next = [{ ...entry, ownerKey }, ...scoped].slice(0, limit)
  writeLocalScanHistory(ownerKey, next)
}

export function clearLocalScanHistory(ownerKey = 'guest') {
  const list = readRawHistory()
  const foreign = list.filter((item) => item?.ownerKey !== ownerKey)
  writeRawHistory(foreign)
}
