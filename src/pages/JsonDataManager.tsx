import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileJson, RefreshCw, Upload } from 'lucide-react'
import { toast } from 'sonner'
import Card, { CardContent } from '../components/Card'
import Button from '../components/Button'
import { HOME_MIN_RATING, JSON_SLOTS, type JsonSlot } from '../lib/jsonFiles'
import { headR2Object, uploadJsonToR2 } from '../lib/r2'

const MAX_BYTES = 25 * 1024 * 1024

interface Summary {
  total: number
  valid: number
  skipped: number
  homeEligible: number
}

type Validation = { ok: true; summary: Summary } | { ok: false; error: string }

/** Mirrors what the app accepts: an array of objects with id > 0 and a non-blank title. */
function validateMovies(text: string): Validation {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e: any) {
    return { ok: false, error: `Not valid JSON: ${String(e?.message ?? e).slice(0, 120)}` }
  }
  if (!Array.isArray(data)) return { ok: false, error: 'The file must be a JSON array: [ {...}, {...} ]' }
  if (data.length === 0) return { ok: false, error: 'The file is an empty array.' }

  let valid = 0
  let homeEligible = 0
  for (const item of data as any[]) {
    const okItem =
      item && typeof item === 'object' &&
      typeof item.id === 'number' && item.id > 0 &&
      typeof item.title === 'string' && item.title.trim() !== ''
    if (!okItem) continue
    valid++
    if (typeof item.rating === 'number' && item.rating > HOME_MIN_RATING) homeEligible++
  }
  if (valid === 0) {
    return { ok: false, error: 'No usable movies found. Each item needs a numeric "id" and a "title".' }
  }
  return { ok: true, summary: { total: data.length, valid, skipped: data.length - valid, homeEligible } }
}

interface SlotState {
  file?: File
  text?: string
  summary?: Summary
  error?: string
  uploading?: boolean
  uploadedNow?: boolean
}

type Live = { size: number; lastModified?: Date } | null | 'unknown'

function formatSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function JsonDataManager() {
  const [slots, setSlots] = useState<Record<string, SlotState>>({})
  const [live, setLive] = useState<Record<string, Live | undefined>>({})
  const [uploadingAll, setUploadingAll] = useState(false)
  const bulkRef = useRef<HTMLInputElement>(null)

  const patch = useCallback((key: string, next: Partial<SlotState>) => {
    setSlots(prev => ({ ...prev, [key]: { ...prev[key], ...next } }))
  }, [])

  const refreshLive = useCallback(async (key: string) => {
    try {
      const info = await headR2Object(key)
      setLive(prev => ({ ...prev, [key]: info }))
    } catch {
      setLive(prev => ({ ...prev, [key]: 'unknown' }))
    }
  }, [])

  useEffect(() => {
    JSON_SLOTS.forEach(s => { void refreshLive(s.key) })
  }, [refreshLive])

  async function chooseFile(slot: JsonSlot, file: File | null | undefined) {
    if (!file) return
    if (file.size > MAX_BYTES) {
      patch(slot.key, { file, text: undefined, summary: undefined, error: 'File is larger than 25 MB.', uploadedNow: false })
      return
    }
    const text = await file.text()
    const result = validateMovies(text)
    if ('error' in result) {
      patch(slot.key, { file, text: undefined, summary: undefined, error: result.error, uploadedNow: false })
    } else {
      patch(slot.key, { file, text, summary: result.summary, error: undefined, uploadedNow: false })
    }
  }

  /** Pick several files at once; each is matched to its slot by file name. */
  async function chooseMany(files: FileList | null) {
    if (!files) return
    const unmatched: string[] = []
    for (const f of Array.from(files)) {
      const slot = JSON_SLOTS.find(s => s.key === f.name.toLowerCase())
      if (slot) await chooseFile(slot, f)
      else unmatched.push(f.name)
    }
    if (unmatched.length) toast.warning(`No slot matches: ${unmatched.join(', ')} (file names must match exactly)`)
    if (bulkRef.current) bulkRef.current.value = ''
  }

  async function uploadSlot(slot: JsonSlot): Promise<boolean> {
    const s = slots[slot.key]
    if (!s?.text || !s.summary) return false
    patch(slot.key, { uploading: true })
    try {
      // Same key every time -> the previous file is replaced by this one.
      await uploadJsonToR2(slot.key, s.text)
      patch(slot.key, { uploading: false, uploadedNow: true, file: undefined, text: undefined })
      await refreshLive(slot.key)
      toast.success(`${slot.label}: replaced with the new file (${s.summary.valid} movies)`)
      return true
    } catch (err: any) {
      console.error(err)
      patch(slot.key, { uploading: false, error: `Upload failed: ${String(err?.message ?? err).slice(0, 160)}` })
      toast.error(`${slot.label}: upload failed`)
      return false
    }
  }

  async function uploadAll() {
    setUploadingAll(true)
    for (const slot of JSON_SLOTS) {
      if (slots[slot.key]?.text) await uploadSlot(slot)
    }
    setUploadingAll(false)
  }

  const readyCount = JSON_SLOTS.filter(s => slots[s.key]?.text).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Movie Data (JSON)</h1>
          <p className="text-sm text-gray-500 mt-1">
            One slot per category. Uploading a file replaces whatever is live in that slot - the old file is
            gone and the new one takes its exact place. Apps pick up the new data the next time they open.
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={bulkRef} type="file" accept=".json,application/json" multiple className="hidden"
            onChange={e => void chooseMany(e.target.files)} />
          <Button variant="outline" onClick={() => bulkRef.current?.click()}>
            <FileJson className="w-4 h-4 mr-2" /> Select multiple files
          </Button>
          <Button onClick={() => void uploadAll()} disabled={readyCount === 0 || uploadingAll} loading={uploadingAll}>
            <Upload className="w-4 h-4 mr-2" /> Upload all ready ({readyCount})
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {JSON_SLOTS.map(slot => {
          const s = slots[slot.key] ?? {}
          const l = live[slot.key]
          return (
            <Card key={slot.key}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{slot.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{slot.key}</p>
                  </div>
                  <button type="button" title="Refresh live status" onClick={() => void refreshLive(slot.key)}
                    className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-gray-100">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-gray-500">
                  Live now:{' '}
                  {l === undefined ? 'checking...'
                    : l === 'unknown' ? 'could not check (R2 CORS must allow HEAD)'
                    : l === null ? 'nothing uploaded yet'
                    : `${formatSize(l.size)}${l.lastModified ? ` - updated ${l.lastModified.toLocaleString()}` : ''}`}
                </p>

                {s.uploadedNow && (
                  <p className="flex items-center gap-1.5 text-sm text-green-700">
                    <CheckCircle2 className="w-4 h-4" /> Replaced successfully
                  </p>
                )}

                {s.file && (
                  <p className="text-sm text-gray-700 truncate">
                    {s.file.name} <span className="text-xs text-gray-400">({formatSize(s.file.size)})</span>
                  </p>
                )}

                {s.summary && (
                  <div className="text-xs text-gray-600 bg-gray-50 border rounded-lg px-3 py-2 space-y-0.5">
                    <p>{s.summary.valid} usable movies{s.summary.skipped > 0 && ` (${s.summary.skipped} skipped: missing id/title)`}</p>
                    <p>{s.summary.homeEligible} will qualify for Home (rating above {HOME_MIN_RATING})</p>
                  </div>
                )}

                {s.error && (
                  <p className="flex items-start gap-1.5 text-sm text-red-600">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {s.error}
                  </p>
                )}

                <div className="flex gap-2">
                  <label className="inline-flex items-center px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer">
                    Choose file
                    <input type="file" accept=".json,application/json" className="hidden"
                      onChange={e => { void chooseFile(slot, e.target.files?.[0]); e.target.value = '' }} />
                  </label>
                  <Button size="sm" onClick={() => void uploadSlot(slot)}
                    disabled={!s.text || s.uploading || uploadingAll} loading={s.uploading}>
                    Replace live file
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
