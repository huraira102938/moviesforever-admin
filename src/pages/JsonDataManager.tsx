import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import Card, { CardContent } from '../components/Card'
import Button from '../components/Button'
import { HOME_MIN_RATING, JSON_SLOTS, type JsonSlot } from '../lib/jsonFiles'
import { fetchLiveJson, headR2Object, uploadJsonToR2, type R2ObjectInfo } from '../lib/r2'

const MAX_BYTES = 25 * 1024 * 1024

interface Summary {
  total: number
  valid: number
  skipped: number
  duplicates: number
  homeEligible: number
  sampleTitles: string[]
}

type Validation = { ok: true; summary: Summary; text: string } | { ok: false; error: string }

/** Mirrors what the app accepts: a JSON array of objects with a numeric id > 0 and a non-blank title. */
function validateMovies(raw: string): Validation {
  const text = raw.replace(/^\uFEFF/, '') // strip BOM
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e: any) {
    return { ok: false, error: `Not valid JSON: ${String(e?.message ?? e).slice(0, 140)}` }
  }
  if (!Array.isArray(data)) return { ok: false, error: 'The file must be a JSON array: [ {...}, {...} ]' }
  if (data.length === 0) return { ok: false, error: 'The file is an empty array.' }

  const seen = new Set<number>()
  let valid = 0
  let duplicates = 0
  let homeEligible = 0
  const sampleTitles: string[] = []
  for (const item of data as any[]) {
    const okItem =
      item && typeof item === 'object' &&
      typeof item.id === 'number' && item.id > 0 &&
      typeof item.title === 'string' && item.title.trim() !== ''
    if (!okItem) continue
    valid++
    if (seen.has(item.id)) duplicates++
    seen.add(item.id)
    if (typeof item.rating === 'number' && item.rating > HOME_MIN_RATING) homeEligible++
    if (sampleTitles.length < 3) sampleTitles.push(item.title)
  }
  if (valid === 0) {
    return { ok: false, error: 'No usable movies found. Each item needs a numeric "id" and a "title".' }
  }
  return { ok: true, text, summary: { total: data.length, valid, skipped: data.length - valid, duplicates, homeEligible, sampleTitles } }
}

interface Picked {
  fileName: string
  size: number
  text?: string
  summary?: Summary
  error?: string
}

interface Live {
  info: R2ObjectInfo | null // null = nothing uploaded yet
  count?: number // movies in the live file (only if the public URL could be read)
}

type LiveState = Live | 'error' | undefined

function formatSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function JsonDataManager() {
  const [picked, setPicked] = useState<Record<string, Picked | undefined>>({})
  const [live, setLive] = useState<Record<string, LiveState>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [justUpdated, setJustUpdated] = useState<Record<string, boolean>>({})

  const refreshLive = useCallback(async (key: string) => {
    try {
      const info = await headR2Object(key)
      let count: number | undefined
      if (info) {
        const json = await fetchLiveJson(key)
        if (Array.isArray(json)) count = json.length
      }
      setLive(prev => ({ ...prev, [key]: { info, count } }))
    } catch {
      setLive(prev => ({ ...prev, [key]: 'error' }))
    }
  }, [])

  useEffect(() => {
    JSON_SLOTS.forEach(s => { void refreshLive(s.key) })
  }, [refreshLive])

  async function choose(slot: JsonSlot, file: File | null | undefined) {
    if (!file) return
    setJustUpdated(prev => ({ ...prev, [slot.key]: false }))
    if (file.size > MAX_BYTES) {
      setPicked(prev => ({ ...prev, [slot.key]: { fileName: file.name, size: file.size, error: 'File is larger than 25 MB.' } }))
      return
    }
    const result = validateMovies(await file.text())
    setPicked(prev => ({
      ...prev,
      [slot.key]: 'error' in result
        ? { fileName: file.name, size: file.size, error: result.error }
        : { fileName: file.name, size: file.size, text: result.text, summary: result.summary },
    }))
  }

  function clear(slot: JsonSlot) {
    setPicked(prev => ({ ...prev, [slot.key]: undefined }))
  }

  async function replace(slot: JsonSlot) {
    const p = picked[slot.key]
    const l = live[slot.key]
    if (!p?.text || !p.summary) return

    const liveCount = l && l !== 'error' ? l.count : undefined
    const msg =
      `Replace the live "${slot.label}" file with ${p.fileName}?\n\n` +
      `New file: ${p.summary.valid} movies\n` +
      (liveCount !== undefined ? `Current live file: ${liveCount} movies\n` : '') +
      `\nThe current file will be permanently overwritten. This cannot be undone.`
    if (!window.confirm(msg)) return

    setBusy(prev => ({ ...prev, [slot.key]: true }))
    try {
      // Same key every time -> the previous file is replaced by this one.
      await uploadJsonToR2(slot.key, p.text)
      setPicked(prev => ({ ...prev, [slot.key]: undefined }))
      setJustUpdated(prev => ({ ...prev, [slot.key]: true }))
      await refreshLive(slot.key)
      toast.success(`${slot.label} updated (${p.summary.valid} movies). The app will pick it up next time it opens.`)
    } catch (err: any) {
      console.error(err)
      setPicked(prev => ({ ...prev, [slot.key]: { ...p, error: `Upload failed: ${String(err?.message ?? err).slice(0, 160)}` } }))
      toast.error(`${slot.label}: upload failed - the old file is unchanged`)
    } finally {
      setBusy(prev => ({ ...prev, [slot.key]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Movie Data (JSON)</h1>
        <p className="text-sm text-gray-500 mt-1">
          One card per category file. Update any of them on its own: choose the new file, check the summary,
          then replace. The old file is overwritten by the new one in the same place. The app only downloads a
          file again when it has changed, and shows the new data the next time it opens.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {JSON_SLOTS.map(slot => {
          const p = picked[slot.key]
          const l = live[slot.key]
          const isBusy = !!busy[slot.key]
          const liveCount = l && l !== 'error' ? l.count : undefined
          const looksSmaller =
            !!p?.summary && liveCount !== undefined && liveCount > 0 && p.summary.valid < liveCount * 0.5

          return (
            <Card key={slot.key}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{slot.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{slot.key}</p>
                  </div>
                  <button
                    type="button"
                    title="Refresh live status"
                    onClick={() => void refreshLive(slot.key)}
                    className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-gray-100"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-gray-600 bg-gray-50 border rounded-lg px-3 py-2 space-y-0.5">
                  <p className="font-medium text-gray-700">Live now</p>
                  {l === undefined && <p>Checking...</p>}
                  {l === 'error' && <p>Could not check (R2 CORS must allow HEAD requests).</p>}
                  {l && l !== 'error' && (
                    l.info === null
                      ? <p>Nothing uploaded yet.</p>
                      : <>
                          <p>
                            {formatSize(l.info.size)}
                            {l.count !== undefined && ` - ${l.count} movies`}
                          </p>
                          {l.info.lastModified && <p>Updated {l.info.lastModified.toLocaleString()}</p>}
                        </>
                  )}
                </div>

                {justUpdated[slot.key] && (
                  <p className="flex items-center gap-1.5 text-sm text-green-700">
                    <CheckCircle2 className="w-4 h-4" /> Updated. Apps will fetch it on their next open.
                  </p>
                )}

                {p && (
                  <div className="border rounded-lg px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-gray-800 truncate">
                        {p.fileName} <span className="text-xs text-gray-400">({formatSize(p.size)})</span>
                      </p>
                      <button
                        type="button"
                        title="Discard this file"
                        onClick={() => clear(slot)}
                        disabled={isBusy}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-gray-100 disabled:opacity-40"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {p.summary && (
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <p>{p.summary.valid} usable movies{p.summary.skipped > 0 && ` (${p.summary.skipped} skipped: missing id or title)`}</p>
                        <p>{p.summary.homeEligible} qualify for Home (rating above {HOME_MIN_RATING})</p>
                        {p.summary.duplicates > 0 && <p className="text-amber-700">{p.summary.duplicates} duplicate ids found</p>}
                        <p className="text-gray-400 truncate">e.g. {p.summary.sampleTitles.join(', ')}</p>
                      </div>
                    )}

                    {looksSmaller && (
                      <p className="flex items-start gap-1.5 text-xs text-amber-700">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        This file has less than half the movies of the live one ({liveCount}). Make sure it is the right file.
                      </p>
                    )}

                    {p.error && (
                      <p className="flex items-start gap-1.5 text-sm text-red-600">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {p.error}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <label className={`inline-flex items-center px-3 h-9 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-indigo-500 hover:text-indigo-600 ${isBusy ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                    Choose JSON file
                    <input
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={e => { void choose(slot, e.target.files?.[0]); e.target.value = '' }}
                    />
                  </label>
                  <Button size="sm" onClick={() => void replace(slot)} disabled={!p?.text || isBusy} loading={isBusy}>
                    <Upload className="w-4 h-4 mr-1.5" /> Replace live file
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
