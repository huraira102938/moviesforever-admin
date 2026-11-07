import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { isUae } from '../lib/market'
import { getMovies } from '../lib/moviesCache'
import type { TrendingItem, Movie } from '../lib/types'
import Button from '../components/Button'
import Badge from '../components/Badge'
import { toast } from 'sonner'
import { Trash2, ChevronUp, ChevronDown, Flame } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import MovieSearchSelect from '../components/MovieSearchSelect'

/** Row number the admin can overwrite: type a position and press Enter (or click away) to jump there. */
function PositionInput({ position, onMove }: { position: number; onMove: (position: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    if (draft) onMove(Number(draft))
    setDraft(null)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label="Position"
      title="Type a position and press Enter"
      value={draft ?? position}
      onChange={e => setDraft(e.target.value.replace(/\D/g, ''))}
      onFocus={e => e.target.select()}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className="text-xs font-mono text-gray-600 w-11 text-center bg-gray-50 border border-gray-200 rounded py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  )
}

/**
 * One ordered movie list. Pakistan's free movies stay the "Free movie" tick on each movie, so the
 * Free list only exists for the UAE.
 */
export default function Trending({ list = 'trending' }: { list?: 'trending' | 'free' }) {
  const isFree = list === 'free'
  const collectionName = isFree ? 'free-uae' : isUae ? 'trending-uae' : 'trending'
  const listName = isFree ? 'Free Movies' : 'Trending'
  const [items, setItems] = useState<TrendingItem[]>([])
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedMovieId, setSelectedMovieId] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TrendingItem | null>(null)

  async function loadData() {
    try {
      const [trendingSnap, movieList] = await Promise.all([
        getDocs(collection(db, collectionName)),
        getMovies(),
      ])
      setItems(trendingSnap.docs.map(d => ({ id: d.id, ...d.data() } as TrendingItem)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      setMovies(movieList)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const nextOrder = items.length > 0 ? Math.max(...items.map(i => i.order ?? 0)) + 1 : 0

  async function handleAdd() {
    if (!selectedMovieId) return toast.error('Select a movie to add')
    if (items.some(i => i.movieId === selectedMovieId)) return toast.error(`This movie is already in ${listName}`)

    setSaving(true)
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        movieId: selectedMovieId,
        order: nextOrder,
      })
      setItems(prev => [...prev, { id: docRef.id, movieId: selectedMovieId, order: nextOrder } as TrendingItem].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      setSelectedMovieId('')
      toast.success(`Movie added to ${listName}`)
    } catch (err) {
      toast.error('Failed to add movie')
    } finally {
      setSaving(false)
    }
  }

  /** Moves a movie to a list index and renumbers the rows in between, so a jump is one save. */
  async function handleMoveTo(item: TrendingItem, target: number) {
    const sorted = [...items]
    const from = sorted.findIndex(i => i.id === item.id)
    const to = Math.min(Math.max(target, 0), sorted.length - 1)
    if (from === to) return
    sorted.splice(to, 0, ...sorted.splice(from, 1))

    const batch = writeBatch(db)
    sorted.forEach((i, position) => {
      if (i.order !== position) batch.update(doc(db, collectionName, i.id), { order: position })
    })
    setItems(sorted.map((i, position) => ({ ...i, order: position })))

    try {
      await batch.commit()
    } catch (err) {
      toast.error('Failed to reorder')
      loadData()
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, collectionName, deleteTarget.id))
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id))
      toast.success(`Movie removed from ${listName}`)
    } catch (err) {
      toast.error('Failed to remove')
    } finally {
      setDeleteTarget(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Loading...</p></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{listName}</h1>
        <p className="text-sm text-gray-500 mt-1">{isFree ? 'Movies UAE users can watch for free' : 'Curate the trending movie shelf shown in the app'}</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-5">
        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 rounded-lg p-3">
          <Flame className="w-5 h-5" />
          <p className="text-sm">Movies appear in this exact order in the app. To move a movie, type its new position in the number box and press Enter. Update the Movie Data (JSON) file after changing this list.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-900">Select Movie to Add</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <MovieSearchSelect movies={movies} value={selectedMovieId} onChange={setSelectedMovieId} placeholder="Search and select a movie" />
            </div>
            <Button onClick={handleAdd} loading={saving} disabled={!selectedMovieId}>Add to {listName}</Button>
          </div>
        </div>

        <p className="text-sm text-gray-500">Will be added at position <strong>{nextOrder}</strong> (end of list)</p>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">Trending Movies ({items.length})</h3>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-gray-400">No movies in trending yet</p>
        ) : (
          <div className="divide-y">
            {items.map((item, idx) => {
              const movie = movies.find(m => m.id === item.movieId)
              return (
                <div key={item.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => handleMoveTo(item, idx - 1)} disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 hover:text-gray-700">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleMoveTo(item, idx + 1)} disabled={idx === items.length - 1}
                      className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 hover:text-gray-700">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <PositionInput position={idx + 1} onMove={position => handleMoveTo(item, position - 1)} />
                  {movie?.thumbnailUrl && <img src={movie.thumbnailUrl} alt="" className="w-10 h-14 rounded object-cover border" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{movie?.badge} {movie?.title || item.movieId}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {movie?.year && <span className="text-xs text-gray-500">{movie.year}</span>}
                      {movie?.language && <span className="text-xs text-gray-400">{movie.language}</span>}
                      {movie?.paused && <Badge variant="warning">Paused</Badge>}
                    </div>
                  </div>
                  <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Remove from Trending"
        message={`Remove "${movies.find(m => m.id === deleteTarget?.movieId)?.title}" from the trending list?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Remove"
      />
    </div>
  )
}