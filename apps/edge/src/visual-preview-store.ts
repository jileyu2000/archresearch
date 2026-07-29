import type { BrowserVisualUploadSource } from './entrypoint'
import type { BrowserVisualSource } from './workflow'

const previewPrefix = 'visual-previews'

function decodeDataUrl(value: string) {
  const encoded = value.slice('data:image/png;base64,'.length)
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function encodeDataUrl(bytes: Uint8Array) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(index, index + 0x8000))
  }
  return `data:image/png;base64,${btoa(binary)}`
}

function objectKey(runId: string, index: number) {
  return `${previewPrefix}/${runId}/${index + 1}.png`
}

function belongsToRun(runId: string, key: string) {
  return key.startsWith(`${previewPrefix}/${runId}/`)
    && /^[A-Za-z0-9_/-]+\.png$/.test(key)
}

export async function storeVisualPreviews(
  bucket: R2Bucket,
  runId: string,
  sources: BrowserVisualUploadSource[],
) {
  const stored: BrowserVisualSource[] = []
  const writtenKeys: string[] = []
  try {
    for (const [index, source] of sources.entries()) {
      const key = source.previewDataUrl ? objectKey(runId, index) : null
      if (key && source.previewDataUrl) {
        await bucket.put(key, decodeDataUrl(source.previewDataUrl), {
          httpMetadata: { contentType: 'image/png' },
        })
        writtenKeys.push(key)
      }
      stored.push({
        directionId: source.directionId,
        sourceUrl: source.sourceUrl,
        title: source.title,
        imageUrl: source.imageUrl,
        previewObjectKey: key,
        adjacentText: source.adjacentText,
      })
    }
    return stored
  } catch (error) {
    if (writtenKeys.length > 0) await bucket.delete(writtenKeys)
    throw error
  }
}

export async function discardVisualPreviews(
  bucket: R2Bucket,
  runId: string,
  sources: BrowserVisualSource[],
) {
  const keys = sources
    .map(({ previewObjectKey }) => previewObjectKey)
    .filter((key): key is string => Boolean(key && belongsToRun(runId, key)))
  if (keys.length > 0) await bucket.delete(keys)
}

export async function readVisualPreview(
  bucket: R2Bucket,
  runId: string,
  key: string,
) {
  if (!belongsToRun(runId, key)) return null
  const object = await bucket.get(key)
  if (!object || object.size > 3_000_000) return null
  return encodeDataUrl(new Uint8Array(await object.arrayBuffer()))
}

export async function cleanupVisualPreviews(bucket: R2Bucket, runId: string) {
  let cursor: string | undefined
  do {
    const listed = await bucket.list({
      prefix: `${previewPrefix}/${runId}/`,
      ...(cursor ? { cursor } : {}),
    })
    if (listed.objects.length > 0) {
      await bucket.delete(listed.objects.map(({ key }) => key))
    }
    cursor = listed.truncated ? listed.cursor : undefined
  } while (cursor)
}
