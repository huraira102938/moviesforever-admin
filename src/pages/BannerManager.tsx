import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getMovies } from '../lib/moviesCache'
import type { Banner, Movie } from '../lib/types'
import FileUploader from '../components/FileUploader'
import Button from '../components/Button'
import Input from '../components/Input'
import Label from '../components/Label'
import Badge from '../components/Badge'
import { toast } from 'sonner'
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import MovieSearchSelect from '../components/MovieSearchSelect'

type ActionType = 'none' | 'movie' | 'link' | 'whatsapp' | 'channel'

const ACTIONS: { value: ActionType; label: string; hint: string }[] = [
  { value: 'none', label: 'Not clickable', hint: 'Just an image' },
  { value: 'movie', label: 'Open a movie', hint: 'Opens that movie inside the app' },
  { value: 'link', label: 'Website link', hint: 'Opens the website in the phone browser' },
  { value: 'whatsapp', label: 'WhatsApp number', hint: 'Opens a WhatsApp chat with this number' },
  { value: 'channel', label: 'WhatsApp channel', hint: 'Opens your WhatsApp channel' },
]

/** What the banner does, as shown in the list. Old banners (no actionType) are movie banners. */
function bannerAction(b: Banner): ActionType {
  if (b.actionType) return b.actionType
  return b.clickable && b.linkedMovieId ? 'movie' : 'none'
}

/** Digits only, with the country code. A Pakistani local number (03001234567) becomes 923001234567. */
function cleanWhatsappNumber(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0') && d.length === 11) d = '92' + d.slice(1)
  return d
}

export default function BannerManager() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)

  const [actionType, setActionType] = useState<ActionType>('none')
  const [linkedMovieId, setLinkedMovieId] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [channelUrl, setChannelUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageKey, setImageKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null)

  async function loadData() {
    try {
      const [bannerSnap, movieList] = await Promise.all([
        getDocs(collection(db, 'banners')),
        getMovies(),
      ])
      setBanners(bannerSnap.docs.map(d => ({ id: d.id, ...d.data() } as Banner)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      setMovies(movieList)
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

    // Work out what a tap does, and check it before saving.
    let actionValue = ''
    if (actionType === 'movie') {
      if (!linkedMovieId) return toast.error('Select the movie this banner opens')
    } else if (actionType === 'link') {
      actionValue = linkUrl.trim()
      if (!/^https?:\/\/\S+\.\S+/i.test(actionValue)) return toast.error('Website link must start with http:// or https://')
    } else if (actionType === 'whatsapp') {
      actionValue = cleanWhatsappNumber(whatsappNumber)
      if (actionValue.length < 8 || actionValue.length > 15) return toast.error('Enter a valid WhatsApp number with country code, e.g. 923001234567')
    } else if (actionType === 'channel') {
      actionValue = channelUrl.trim()
      if (!/^https?:\/\/(www\.)?whatsapp\.com\/channel\/\S+/i.test(actionValue)) return toast.error('Channel link must look like https://whatsapp.com/channel/...')
    }

    const clickable = actionType !== 'none'
    const movieId = actionType === 'movie' ? linkedMovieId : null
    setSaving(true)
    try {
      const docRef = await addDoc(collection(db, 'banners'), {
        imageKey,
        imageUrl,
        clickable,
        linkedMovieId: movieId,
        actionType,
        actionValue,
        order: nextOrder,
      })
      setBanners(prev => [...prev, { id: docRef.id, imageKey, imageUrl, clickable, linkedMovieId: movieId || undefined, actionType, actionValue, order: nextOrder } as Banner].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
      setImageKey('')
      setImageUrl('')
      setActionType('none')
      setLinkedMovieId('')
      setLinkUrl('')
      setWhatsappNumber('')
      setChannelUrl('')
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
        <p className="text-sm text-gray-500 mt-1">Upload and manage home screen banners. A banner can open a movie, a website, a WhatsApp chat or a WhatsApp channel.</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-5">
        <h2 className="text-lg font-semibold">Add New Banner</h2>

        <FileUploader label="Banner Image" accept="image/jpeg,image/png,image/webp"
          onUpload={(key, url) => { setImageKey(key); setImageUrl(url) }} />

        <div className="space-y-3">
          <Label>When the user taps this banner</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ACTIONS.map(a => (
              <label
                key={a.value}
                className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer ${actionType === a.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <input
                  type="radio"
                  name="banner-action"
                  className="mt-1"
                  checked={actionType === a.value}
                  onChange={() => setActionType(a.value)}
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{a.label}</span>
                  <span className="block text-xs text-gray-500">{a.hint}</span>
                </span>
              </label>
            ))}
          </div>

          {actionType === 'movie' && (
            <div className="space-y-1.5">
              <Label>Movie to open</Label>
              <MovieSearchSelect movies={movies} value={linkedMovieId} onChange={setLinkedMovieId} placeholder="Search and select a movie" />
            </div>
          )}

          {actionType === 'link' && (
            <div className="space-y-1.5">
              <Label>Website link</Label>
              <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://moviesforever.online" />
            </div>
          )}

          {actionType === 'whatsapp' && (
            <div className="space-y-1.5">
              <Label>WhatsApp number</Label>
              <Input value={whatsappNumber} onChange={e => setWhatsappNumber(e.target.value)} placeholder="923001234567" />
              <p className="text-xs text-gray-500">
                With country code. A number starting with 0 (like 03001234567) is changed to 92... automatically.
                {whatsappNumber.trim() && <> Will open: <strong>wa.me/{cleanWhatsappNumber(whatsappNumber) || '—'}</strong></>}
              </p>
            </div>
          )}

          {actionType === 'channel' && (
            <div className="space-y-1.5">
              <Label>WhatsApp channel link</Label>
              <Input value={channelUrl} onChange={e => setChannelUrl(e.target.value)} placeholder="https://whatsapp.com/channel/..." />
              <p className="text-xs text-gray-500">In WhatsApp: open your channel, tap the channel name, then "Share link" and paste it here.</p>
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
          const action = bannerAction(banner)
          const actionLabel = ACTIONS.find(a => a.value === action)?.label ?? 'Not clickable'
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
                <Badge variant={action !== 'none' ? 'info' : 'default'}>{actionLabel}</Badge>
                {action === 'movie' && linkedMovie && <span className="ml-2 text-sm text-gray-500">→ {linkedMovie.title}</span>}
                {action === 'movie' && !linkedMovie && <span className="ml-2 text-sm text-red-500">→ movie not found</span>}
                {action === 'link' && <span className="ml-2 text-sm text-gray-500 break-all">→ {banner.actionValue}</span>}
                {action === 'channel' && <span className="ml-2 text-sm text-gray-500 break-all">→ {banner.actionValue}</span>}
                {action === 'whatsapp' && <span className="ml-2 text-sm text-gray-500">→ +{banner.actionValue}</span>}
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