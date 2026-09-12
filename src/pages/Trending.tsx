import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { TrendingItem, Movie } from '../lib/types'
import Button from '../components/Button'
import Badge from '../components/Badge'
import { toast } from 'sonner'
import { Trash2, ChevronUp, ChevronDown, Flame } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import MovieSearchSelect from '../components/MovieSearchSelect'

export default function Trending() {
  const [items, setItems] = useState<TrendingItem[]>([])
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedMovieId, setSelectedMovieId] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TrendingItem | null>(null)

  async function loadData() {
    try {
      const [trendingSnap, movieSnap] = await Promise.all([
        getDocs(collection(db, 'trending')),
        getDocs(collection(db, 'movies')),
      ])
      setItems(trendingSnap.docs.map(d => ({ id: d.id, ...d.data() } as TrendingItem)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      setMovies(movieSnap.docs.map(d => ({ id: d.id, ...d.data() } as Movie)))
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
    if (items.some(i => i.movieId === selectedMovieId)) return toast.error('This movie is already in the trending list')

    setSaving(true)
    try {
      const docRef = await addDoc(collection(db, 'trending'), {
        movieId: selectedMovieId,
        order: nextOrder,
      })
      setItems(prev => [...prev, { id: docRef.id, movieId: selectedMovieId, order: nextOrder } as TrendingItem].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      setSelectedMovieId('')
      toast.success('Movie added to trending')
    } catch (err) {
      toast.error('Failed to add movie')
    } finally {
      setSaving(false)
    }
  }

  async function handleMove(item: TrendingItem, direction: 'up' | 'down') {
    const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const idx = sorted.findIndex(i => i.id === item.id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === sorted.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const other = sorted[swapIdx]

    try {
      await Promise.all([
        updateDoc(doc(db, 'trending', item.id), { order: other.order }),
        updateDoc(doc(db, 'trending', other.id), { order: item.order }),
      ])
      setItems(prev => prev.map(i => {
        if (i.id === item.id) return { ...i, order: other.order }
        if (i.id === other.id) return { ...i, order: item.order }
        return i
      }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
    } catch (err) {
      toast.error('Failed to reorder')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'trending', deleteTarget.id))
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id))
      toast.success('Movie removed from trending')
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
        <h1 className="text-2xl font-bold text-gray-900">Trending</h1>
        <p className="text-sm text-gray-500 mt-1">Curate the trending movie shelf shown in the app</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-5">
        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 rounded-lg p-3">
          <Flame className="w-5 h-5" />
          <p className="text-sm">Movies appear in this exact order in the trending section.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-900">Select Movie to Add</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <MovieSearchSelect movies={movies} value={selectedMovieId} onChange={setSelectedMovieId} placeholder="Search and select a movie" />
            </div>
            <Button onClick={handleAdd} loading={saving} disabled={!selectedMovieId}>Add to Trending</Button>
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
                    <button onClick={() => handleMove(item, 'up')} disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 hover:text-gray-700">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleMove(item, 'down')} disabled={idx === items.length - 1}
                      className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 hover:text-gray-700">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs font-mono text-gray-400 w-6 text-center bg-gray-50 rounded py-1">{idx + 1}</span>
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