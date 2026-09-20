/**
 * One-time fix-up script: adds a long-lived Cache-Control header to every
 * object ALREADY in the R2 bucket (files uploaded before the upload-code
 * fix in `src/lib/r2.ts` existed won't have this header, and Cloudflare
 * won't cache them without it).
 *
 * This does NOT re-upload any file content -- it uses R2's CopyObject
 * (object copied onto itself, with new metadata) which only touches
 * metadata, so it's fast and cheap even for large video files.
 *
 * Safe to re-run: objects that already have the target Cache-Control are
 * skipped, so if it's interrupted partway through you can just run it
 * again.
 *
 * Usage (from the moviesforever-admin project root):
 *   node scripts/retag-r2-cache-headers.mjs
 *   node scripts/retag-r2-cache-headers.mjs --dry-run   # preview only, no changes
 *
 * Reads the same R2 credentials your admin panel already uses, from a
 * `.env` file in the project root (same variable names as `.env.example`):
 *   VITE_CLOUDFLARE_ACCOUNT_ID
 *   VITE_R2_ACCESS_KEY_ID
 *   VITE_R2_SECRET_ACCESS_KEY
 *   VITE_R2_BUCKET_NAME
 */

import dotenv from 'dotenv'
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3'

dotenv.config()

const DRY_RUN = process.argv.includes('--dry-run')

const ACCOUNT_ID = process.env.VITE_CLOUDFLARE_ACCOUNT_ID
const ACCESS_KEY_ID = process.env.VITE_R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.VITE_R2_SECRET_ACCESS_KEY
const BUCKET = process.env.VITE_R2_BUCKET_NAME

const LONG_LIVED_CACHE_CONTROL = 'public, max-age=31536000, immutable'

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET) {
  console.error(
    'Missing R2 env vars. Make sure .env (in the project root) has ' +
      'VITE_CLOUDFLARE_ACCOUNT_ID, VITE_R2_ACCESS_KEY_ID, ' +
      'VITE_R2_SECRET_ACCESS_KEY, and VITE_R2_BUCKET_NAME set.'
  )
  process.exit(1)
}

const s3 = new S3Client({
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  forcePathStyle: true,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  maxAttempts: 5,
})

/** Encodes a key for use in a CopySource header: every path segment gets
 * URI-encoded, but the `/` separators between segments are preserved. */
function encodeCopySource(bucket, key) {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  return `${bucket}/${encodedKey}`
}

async function listAllKeys() {
  const keys = []
  let continuationToken

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        ContinuationToken: continuationToken,
      })
    )
    for (const obj of page.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (continuationToken)

  return keys
}

async function retagObject(key) {
  const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))

  if (head.CacheControl === LONG_LIVED_CACHE_CONTROL) {
    return 'skipped'
  }

  if (DRY_RUN) {
    return 'would-update'
  }

  await s3.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      Key: key,
      CopySource: encodeCopySource(BUCKET, key),
      MetadataDirective: 'REPLACE',
      ContentType: head.ContentType || 'application/octet-stream',
      CacheControl: LONG_LIVED_CACHE_CONTROL,
    })
  )
  return 'updated'
}

async function main() {
  console.log(`Bucket: ${BUCKET}${DRY_RUN ? '  (dry run -- no changes will be made)' : ''}`)
  console.log('Listing objects...')
  const keys = await listAllKeys()
  console.log(`Found ${keys.length} object(s).\n`)

  const counts = { updated: 0, skipped: 0, 'would-update': 0, failed: 0 }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const progress = `[${i + 1}/${keys.length}]`
    try {
      const result = await retagObject(key)
      counts[result]++
      if (result !== 'skipped') {
        console.log(`${progress} ${result}: ${key}`)
      }
    } catch (err) {
      counts.failed++
      console.error(`${progress} FAILED: ${key} -- ${err.message || err}`)
    }
  }

  console.log('\nDone.')
  console.log(
    `  Updated:       ${counts.updated}\n` +
      `  Already OK:    ${counts.skipped}\n` +
      `  Would update:  ${counts['would-update']}\n` +
      `  Failed:        ${counts.failed}`
  )
  if (DRY_RUN && counts['would-update'] > 0) {
    console.log('\nRe-run without --dry-run to actually apply these changes.')
  }
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
