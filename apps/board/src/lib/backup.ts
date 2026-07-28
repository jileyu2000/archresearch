export const lastBackupStorageKey = 'archresearch.lastBackupDownload'

export interface LastBackupRecord {
  at: string
  bytes: number
}

export function readLastBackupRecord(): LastBackupRecord | null {
  try {
    const raw = window.localStorage.getItem(lastBackupStorageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: unknown; bytes?: unknown }
    if (typeof parsed.at !== 'string' || typeof parsed.bytes !== 'number') return null
    return { at: parsed.at, bytes: parsed.bytes }
  } catch {
    return null
  }
}

export function formatBackupSize(bytes: number) {
  if (bytes < 1048576) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function formatBackupTime(at: string) {
  const time = new Date(at)
  if (Number.isNaN(time.getTime())) return at
  return `${time.getMonth() + 1} 月 ${time.getDate()} 日 ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
}
