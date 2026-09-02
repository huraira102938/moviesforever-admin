import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Movie, Category, Genre } from '../lib/types'
import { SECTIONS } from '../lib/types'
import Button from '../components/Button'
import Badge from '../components/Badge'
import { toast } from 'sonner'
import { Edit, Trash2, Search, Pause, Play } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

export default function MovieList() {
  const navigate = useNavigate()
  const [movies, setMovies] = useState<Movie[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [genres, setGenres] = useState<Genre[]>([])
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Movie | null>(null)

  async function loadData() {
    try {
      const [movieSnap, catSnap, genreSnap] = await Promise.all([
        getDocs(collection(db, 'movies')),
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'genres')),
      ])
      setMovies(movieSnap.docs.map(d => ({ id: d.id, ...d.data() } as Movie)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category)))
      setGenres(genreSnap.docs.map(d => ({ id: d.id, ...d.data() } as Genre)))
    } catch (err) {
      console.error(err)
      toast.error('Failed to load movies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  function getCatName(id: string) { return categories.find(c => c.id === id)?.name || id }
  function getGenreName(id: string) { return genres.find(g => g.id === id)?.name || id }

  async function togglePause(movie: Movie) {
    try {
      await updateDoc(doc(db, 'movies', movie.id), { paused: !movie.paused, updatedAt: new Date().toISOString() })
      setMovies(prev => prev.map(m => m.id === movie.id ? { ...m, paused: !m.paused } : m))
      toast.success(movie.paused ? 'Movie resumed' : 'Movie paused')
    } catch (err) {
      toast.error('Failed to update')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'movies', deleteTarget.id))
      setMovies(prev => prev.filter(m => m.id !== deleteTarget.id))
      toast.success('Movie deleted')
    } catch (err) {
      toast.error('Failed to delete')
    } finally {
      setDeleteTarget(null)
    }
  }

  const filtered = movies.filter(m => {
    const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCategory || m.category === filterCategory
    return matchSearch && matchCat
  })

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Loading movies...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Movies</h1>
          <p className="text-sm text-gray-500 mt-1">{movies.length} total movies</p>
        </div>
        <Button onClick={() => navigate('/movies/upload')}>+ Upload Movie</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Movie</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Year</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Sections</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(movie => (
              <tr key={movie.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {movie.thumbnailUrl && <img src={movie.thumbnailUrl} alt="" className="w-10 h-14 rounded object-cover" />}
                    <div>
                      <p className="font-medium text-gray-900">{movie.badge} {movie.title}</p>
                      <p className="text-xs text-gray-400">{movie.language} · {movie.genres.map(g => getGenreName(g)).join(', ')}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{getCatName(movie.category)}</td>
                <td className="px-4 py-3 text-gray-600">{movie.year}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {movie.sections?.map(s => {
                      const sec = SECTIONS.find(x => x.value === s)
                      return <Badge key={s} variant="info">{sec?.label || s}</Badge>
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {movie.paused ? <Badge variant="warning">Paused</Badge> : <Badge variant="success">Live</Badge>}
                  {movie.isFree && <Badge variant="info" className="ml-1">Free</Badge>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => navigate(`/movies/edit/${movie.id}`)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-indigo-600" title="Edit">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => togglePause(movie)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-amber-600" title={movie.paused ? 'Resume' : 'Pause'}>
                      {movie.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setDeleteTarget(movie)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No movies found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal open={Boolean(deleteTarget)} title="Delete Movie" message={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} confirmLabel="Delete" />
    </div>
  )
}