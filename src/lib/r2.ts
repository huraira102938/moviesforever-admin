import { S3Client, UploadPartCommand, CreateMultipartUploadCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3'

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
  }))
  return { Key: key }
}

export function getR2PublicUrl(key: string): string {
  return `${import.meta.env.VITE_R2_PUBLIC_URL}/${key}`
}

export { r2Client }
