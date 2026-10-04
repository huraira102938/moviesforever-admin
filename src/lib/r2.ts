import { S3Client, PutObjectCommand, HeadObjectCommand, UploadPartCommand, CreateMultipartUploadCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3'

const r2Client = new S3Client({
  endpoint: `https://${import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  forcePathStyle: true,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  },
  maxAttempts: 5,
})

const CHUNK_SIZE = 16 * 1024 * 1024 // 16MB per part

// R2 objects are immutable in practice: uploads always get a brand-new key
// (see the `-${Date.now()}` suffix used everywhere this is called from), so
// it's always safe to tell every cache in the chain -- Cloudflare's edge,
// and any browser/ExoPlayer cache on the client -- to hold onto these for a
// full year without re-checking. This is what actually lets Cloudflare
// serve repeat requests for the same video/thumbnail from its edge cache
// instead of hitting this R2 bucket (and being billed for it) every time.
//
// IMPORTANT: because of `immutable`, if a file at an existing key ever
// needs to change, upload it under a NEW key instead of overwriting this
// one -- otherwise caches (edge and client) may keep serving the old bytes
// for up to a year.
const LONG_LIVED_CACHE_CONTROL = 'public, max-age=31536000, immutable'

async function uploadMultipart(
  file: File,
  key: string,
  onProgress?: (loaded: number, total: number) => void,
) {
  const bucket = import.meta.env.VITE_R2_BUCKET_NAME
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

  const createResp = await r2Client.send(new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: file.type || 'application/octet-stream',
    CacheControl: LONG_LIVED_CACHE_CONTROL,
    ContentDisposition: 'attachment',
  }))
  const uploadId = createResp.UploadId

  if (!uploadId) throw new Error('Failed to start multipart upload')

  let uploadedBytes = 0
  const parts: { PartNumber: number; ETag: string }[] = []

  try {
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)
      const body = new Uint8Array(await chunk.arrayBuffer())

      const partResp = await r2Client.send(new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: i + 1,
        Body: body,
        ContentLength: body.byteLength,
      }))

      if (!partResp.ETag) throw new Error(`Failed to upload part ${i + 1}`)
      parts.push({ PartNumber: i + 1, ETag: partResp.ETag })
      uploadedBytes += body.byteLength

      if (onProgress) onProgress(uploadedBytes, file.size)
    }

    await r2Client.send(new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }))

    return { Key: key }
  } catch (err) {
    try {
      await r2Client.send(new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      }))
    } catch (_) { /* ignore abort errors */ }
    throw err
  }
}

export async function uploadToR2(
  file: File,
  key: string,
  onProgress?: (loaded: number, total: number) => void,
) {
  // Files >100MB use chunked multipart upload (memory-safe)
  if (file.size > 100 * 1024 * 1024) {
    return uploadMultipart(file, key, onProgress)
  }

  // Small files use direct single-body upload
  const { PutObjectCommand } = await import('@aws-sdk/client-s3')
  const body = new Uint8Array(await file.arrayBuffer())
  await r2Client.send(new PutObjectCommand({
    Bucket: import.meta.env.VITE_R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: file.type || 'application/octet-stream',
    CacheControl: LONG_LIVED_CACHE_CONTROL,
    ContentDisposition: 'attachment',
  }))
  return { Key: key }
}

// ---------------------------------------------------------------------------
// Fixed-name JSON data files (bollywood.json, hollywood.json, ...)
//
// Unlike videos/thumbnails these keep the SAME key forever and are replaced in
// place, so they must NOT use LONG_LIVED_CACHE_CONTROL ("immutable", 1 year) --
// otherwise Cloudflare's edge and the phones would keep serving the old file.
// `no-cache` = caches may store it but must re-check before using it.
//
// R2 PutObject on an existing key replaces the old object in one atomic step:
// the previous file is gone and the new one takes its place, with no moment
// where the file is missing.
// ---------------------------------------------------------------------------
const JSON_CACHE_CONTROL = 'no-cache'

export async function uploadJsonToR2(key: string, jsonText: string) {
  await r2Client.send(new PutObjectCommand({
    Bucket: import.meta.env.VITE_R2_BUCKET_NAME,
    Key: key,
    Body: new TextEncoder().encode(jsonText),
    ContentType: 'application/json; charset=utf-8',
    CacheControl: JSON_CACHE_CONTROL,
  }))
  return { Key: key }
}

/** Size + last-modified of what is currently stored at `key`, or null if it doesn't exist. */
export async function headR2Object(key: string): Promise<{ size: number; lastModified?: Date } | null> {
  try {
    const res = await r2Client.send(new HeadObjectCommand({
      Bucket: import.meta.env.VITE_R2_BUCKET_NAME,
      Key: key,
    }))
    return { size: res.ContentLength ?? 0, lastModified: res.LastModified }
  } catch (err: any) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) return null
    throw err
  }
}

export function getR2PublicUrl(key: string): string {
  return `${import.meta.env.VITE_R2_PUBLIC_URL}/${key}`
}

export { r2Client }
