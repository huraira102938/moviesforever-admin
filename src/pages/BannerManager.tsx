import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Banner, Movie } from '../lib/types'
import FileUploader from '../components/FileUploader'
import Button from '../components/Button'
import Input from '../components/Input'
import Label from '../components/Label'
import Badge from '../components/Badge'
import { toast } from 'sonner'
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

export default function BannerManager() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)

  const [clickable, setClickable] = useState(false)
  const [linkedMovieId, setLinkedMovieId] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageKey, setImageKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null)

  async function loadData() {
    try {
      const [bannerSnap, movieSnap] = await Promise.all([
        getDocs(collection(db, 'banners')),
        getDocs(collection(db, 'movies')),
      ])
      setBanners(bannerSnap.docs.map(d => ({ id: d.id, ...d.data() } as Banner)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      setMovies(movieSnap.docs.map(d => ({ id: d.id, ...d.data() } as Movie)))
    } catch (err) {
      console.error(err)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const nextOrder = banners.length > 0 ? Math.max(...banners.map(b => b.order ?? 0)) + 1 : 0

  async function handleAdd() {
    if (!imageKey) return toast.error('Upload a banner image first')
    setSaving(true)
    try {
      const docRef = await addDoc(collection(db, 'banners'), {
        imageKey,
        imageUrl,
        clickable,
        linkedMovieId: clickable ? linkedMovieId : null,
        order: nextOrder,
      })
      setBanners(prev => [...prev, { id: docRef.id, imageKey, imageUrl, clickable, linkedMovieId: linkedMovieId || undefined, order: nextOrder } as Banner].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      setImageKey('')
      setImageUrl('')
      setClickable(false)
      setLinkedMovieId('')
      toast.success('Banner added')
    } catch (err) {
      toast.error('Failed to add banner')
    } finally {
      setSaving(false)
    }
  }

  async function handleMove(banner: Banner, direction: 'up' | 'down') {
    const sorted = [...banners].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const idx = sorted.findIndex(b => b.id === banner.id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === sorted.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const other = sorted[swapIdx]

    try {
      await Promise.all([
        updateDoc(doc(db, 'banners', banner.id), { order: other.order }),
        updateDoc(doc(db, 'banners', other.id), { order: banner.order }),
      ])
      setBanners(prev => prev.map(b => {
        if (b.id === banner.id) return { ...b, order: other.order }
        if (b.id === other.id) return { ...b, order: banner.order }
        return b
      }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
    } catch (err) {
      toast.error('Failed to reorder')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'banners', deleteTarget.id))
      setBanners(prev => prev.filter(b => b.id !== deleteTarget.id))
      toast.success('Banner deleted')
    } catch (err) {
      toast.error('Failed to delete')
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
        <h1 className="text-2xl font-bold text-gray-900">Banner Management</h1>
        <p className="text-sm text-gray-500 mt-1">Upload and manage home screen banners</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-5">
        <h2 className="text-lg font-semibold">Add New Banner</h2>

        <FileUploader label="Banner Image" accept="image/jpeg,image/png,image/webp"
          onUpload={(key, url) => { setImageKey(key); setImageUrl(url) }} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 pt-6">
            <input type="checkbox" id="clickable" checked={clickable} onChange={e => setClickable(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
            <Label htmlFor="clickable" className="cursor-pointer">Clickable (links to a movie)</Label>
          </div>
          {clickable && (
            <div className="space-y-1.5">
              <Label>Linked Movie</Label>
              <select value={linkedMovieId} onChange={e => setLinkedMovieId(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select movie</option>
                {movies.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>Order will be: <strong>{nextOrder}</strong> (appended to end)</span>
        </div>

        <Button onClick={handleAdd} loading={saving} disabled={!imageKey}>Add Banner</Button>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Current Banners ({banners.length})</h2>
        {banners.length === 0 && <p className="text-sm text-gray-400">No banners yet</p>}
        {banners.map((banner, idx) => {
          const linkedMovie = movies.find(m => m.id === banner.linkedMovieId)
          return (
            <div key={banner.id} className="bg-white rounded-xl border p-4 flex items-center gap-4">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => handleMove(banner, 'up')} disabled={idx === 0}
                  className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 hover:text-gray-700">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => handleMove(banner, 'down')} disabled={idx === banners.length - 1}
                  className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed text-gray-400 hover:text-gray-700">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <span className="text-xs font-mono text-gray-400 w-6 text-center bg-gray-50 rounded py-1">{banner.order ?? idx}</span>
              {banner.imageUrl && <img src={banner.imageUrl} alt="" className="w-40 h-20 rounded-lg object-cover border" />}
              <div className="flex-1">
                <Badge variant={banner.clickable ? 'info' : 'default'}>{banner.clickable ? 'Clickable' : 'Non-clickable'}</Badge>
                {linkedMovie && <span className="ml-2 text-sm text-gray-500">→ {linkedMovie.title}</span>}
              </div>
              <button onClick={() => setDeleteTarget(banner)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          )
        })}
      </div>

      <ConfirmModal open={Boolean(deleteTarget)} title="Delete Banner" message="Are you sure you want to delete this banner?" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} confirmLabel="Delete" />
    </div>
  )
}