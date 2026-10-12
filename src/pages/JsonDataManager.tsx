import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileJson, RefreshCw, Upload } from 'lucide-react'
import { toast } from 'sonner'
import Card, { CardContent } from '../components/Card'
import Button from '../components/Button'
import {
  CATALOGUE_BACKUP_KEY,
  CATALOGUE_KEY,
  buildCatalogue,
  diffCatalogue,
  loadSources,
  parseCatalogue,
  serializeCatalogue,
  type BuildResult,
  type CatalogueDiff,
  type CatalogueFile,
} from '../lib/catalogueJson'
import { getTextFromR2, headR2Object, uploadJsonToR2, type R2ObjectInfo } from '../lib/r2'

interface Preview {
  build: BuildResult
  diff: CatalogueDiff
  live: CatalogueFile | null
  liveText: string | null
  text: string
}

function formatSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function TitleList({ label, titles, tone }: { label: string; titles: string[]; tone: string }) {
  if (titles.length === 0) return null
  const shown = titles.slice(0, 12)
  return (
    <div className="text-sm">
      <p className={`font-medium ${tone}`}>{label} ({titles.length})</p>
      <p className="text-xs text-gray-600">
        {shown.join(', ')}
        {titles.length > shown.length && ` ... and ${titles.length - shown.length} more`}
      </p>
    </div>
  )
}

/** Plain-words list of what the app will show: only categories that have movies, Trending only if it has any. */
function AppWillShow({ file }: { file: CatalogueFile }) {
  const counts = new Map<string, number>()
  file.movies.forEach(m => counts.set(m.category, (counts.get(m.category) ?? 0) + 1))
  const shelves = file.categories.filter(c => (counts.get(c.id) ?? 0) > 0)
  return (
    <div className="text-xs text-gray-600 bg-gray-50 border rounded-lg px-3 py-2 space-y-0.5">
      <p className="font-medium text-gray-700">The app will show</p>
      {shelves.map(c => <p key={c.id}>{c.name}: {counts.get(c.id)} movies</p>)}
      <p>{file.trending.length > 0 ? `Trending: ${file.trending.length} movies` : 'No Trending section (nothing in the Trending list)'}</p>
      <p className="text-gray-400">A category with no movies is not shown.</p>
    </div>
  )
}

export default function JsonDataManager() {
  const [synced, setSynced] = useState<CatalogueFile | null>(null)
  const [info, setInfo] = useState<R2ObjectInfo | null | 'error' | undefined>(undefined)
  const [liveCount, setLiveCount] = useState<number | undefined>()
  const [checking, setChecking] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [upToDate, setUpToDate] = useState(false)
  const [justPublished, setJustPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshLive = useCallback(async () => {
    try {
      const head = await headR2Object(CATALOGUE_KEY)
      setInfo(head)
      if (head) {
        const live = parseCatalogue(await getTextFromR2(CATALOGUE_KEY))
        setLiveCount(live?.movies.length)
      } else {
        setLiveCount(undefined)
      }
    } catch {
      setInfo('error')
    }
  }, [])

  useEffect(() => { void refreshLive() }, [refreshLive])

  /** Step 1: read Firestore + the live file, work out what changed. Nothing is uploaded yet. */
  async function checkForChanges() {
    setChecking(true)
    setError(null)
    setPreview(null)
    setUpToDate(false)
    setSynced(null)
    setJustPublished(false)
    try {
      const [sources, liveText] = await Promise.all([loadSources(), getTextFromR2(CATALOGUE_KEY)])
      const live = parseCatalogue(liveText)
      if (liveText && !live) {
        toast.warning('The live movies.json could not be read - it will be rebuilt completely.')
      }
      const build = buildCatalogue(sources)
      if (build.file.movies.length === 0) {
        setError('There are no publishable movies in Firestore (every movie is paused or has no video yet). Nothing was changed.')
        return
      }
      const diff = diffCatalogue(live, build.file)
      if (!diff.hasChanges) {
        setSynced(build.file)
        setUpToDate(true)
        return
      }
      setPreview({ build, diff, live, liveText, text: serializeCatalogue(build.file) })
    } catch (err: any) {
      console.error(err)
      setError(`Could not check for changes: ${String(err?.message ?? err).slice(0, 200)}`)
    } finally {
      setChecking(false)
    }
  }

  /** Step 2: upload once. The previous file is first copied to movies.prev.json as a safety net. */
  async function publish() {
    if (!preview) return
    const { diff, build, live, liveText, text } = preview
    const liveTotal = live?.movies.length ?? 0
    if (liveTotal > 0 && build.file.movies.length < liveTotal * 0.5) {
      const ok = window.confirm(
        `The new file has ${build.file.movies.length} movies but the live one has ${liveTotal}.\n` +
        `That is less than half. Publish anyway?`,
      )
      if (!ok) return
    }

    setPublishing(true)
    try {
      if (liveText) await uploadJsonToR2(CATALOGUE_BACKUP_KEY, liveText)
      await uploadJsonToR2(CATALOGUE_KEY, text)
      setPreview(null)
      setJustPublished(true)
      await refreshLive()
      toast.success(
        `movies.json updated: ${diff.added.length} added, ${diff.updated.length} changed, ${diff.removed.length} removed. ` +
        `Phones download it the next time the app opens.`,
      )
    } catch (err: any) {
      console.error(err)
      setError(`Upload failed: ${String(err?.message ?? err).slice(0, 200)}. The live file was not changed.`)
      toast.error('Upload failed - the live file is unchanged')
    } finally {
      setPublishing(false)
    }
  }

  const busy = checking || publishing

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Movie Data (JSON)</h1>
        <p className="text-sm text-gray-500 mt-1">
          The app reads all movies from one file, <span className="font-mono">{CATALOGUE_KEY}</span>, never from Firebase.
          Upload movies all week as usual, then press <b>Check for updates</b> once. It compares your Firebase data
          with the JSON file and shows what is new, changed or removed. Only movies that exist in Firebase stay in the
          JSON. Nothing is uploaded until you press <b>Update JSON file</b>. Phones download the file only when it
          changes and keep a saved copy.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileJson className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="font-semibold text-gray-900">Live file</p>
                <p className="text-xs text-gray-400 font-mono">{CATALOGUE_KEY}</p>
              </div>
            </div>
            <button
              type="button"
              title="Refresh live status"
              onClick={() => void refreshLive()}
              disabled={busy}
              className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-gray-100 disabled:opacity-40"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs text-gray-600 bg-gray-50 border rounded-lg px-3 py-2 space-y-0.5">
            {info === undefined && <p>Checking...</p>}
            {info === 'error' && <p>Could not check (R2 CORS must allow HEAD and GET requests).</p>}
            {info === null && <p>Nothing uploaded yet. The first update creates the file.</p>}
            {info && info !== 'error' && (
              <>
                <p>
                  {formatSize(info.size)}
                  {liveCount !== undefined && ` - ${liveCount} movies`}
                </p>
                {info.lastModified && <p>Last updated {info.lastModified.toLocaleString()}</p>}
              </>
            )}
          </div>

          <Button onClick={() => void checkForChanges()} loading={checking} disabled={busy}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Check for updates
          </Button>

          {upToDate && (
            <>
              <p className="flex items-center gap-1.5 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4" /> The JSON file already matches Firebase. Nothing to update, nothing was uploaded.
              </p>
              {synced && <AppWillShow file={synced} />}
            </>
          )}

          {justPublished && (
            <p className="flex items-center gap-1.5 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4" /> Updated. Apps will fetch the new file the next time they open.
            </p>
          )}

          {error && (
            <p className="flex items-start gap-1.5 text-sm text-red-600">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="font-semibold text-gray-900">The JSON file is out of date. Changes found:</p>

            <p className="text-sm text-gray-700">
              New file: <b>{preview.build.file.movies.length}</b> movies
              {preview.live && <> (live now: {preview.live.movies.length})</>}
              {' '}- {formatSize(new TextEncoder().encode(preview.text).length)}
            </p>

            <TitleList label="New" titles={preview.diff.added.map(m => m.title)} tone="text-green-700" />
            <TitleList label="Changed" titles={preview.diff.updated.map(m => m.title)} tone="text-indigo-700" />
            <TitleList label="Removed (deleted or paused)" titles={preview.diff.removed.map(m => m.title)} tone="text-red-700" />
            {preview.diff.categoriesChanged && <p className="text-sm text-indigo-700">Categories changed</p>}
            {preview.diff.trendingChanged && <p className="text-sm text-indigo-700">Trending list changed</p>}
            {preview.diff.bannersChanged && <p className="text-sm text-indigo-700">Banners changed</p>}

            {preview.build.skippedIncomplete.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Left out (no title or no video file yet): {preview.build.skippedIncomplete.slice(0, 8).join(', ')}
              </p>
            )}
            {preview.build.noCategory.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Category missing, so these show in Search but on no Home shelf: {preview.build.noCategory.slice(0, 8).join(', ')}
              </p>
            )}

            <AppWillShow file={preview.build.file} />

            <div className="flex gap-2 pt-1">
              <Button onClick={() => void publish()} loading={publishing} disabled={busy}>
                <Upload className="w-4 h-4 mr-1.5" /> Update JSON file
              </Button>
              <Button variant="secondary" onClick={() => setPreview(null)} disabled={busy}>
                Cancel
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              The previous file is kept as <span className="font-mono">{CATALOGUE_BACKUP_KEY}</span> in case you need to go back.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
