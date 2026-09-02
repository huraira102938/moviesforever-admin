import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { collection, getDocs, doc, addDoc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { SECTIONS } from '../lib/types'
import type { Category, Genre } from '../lib/types'
import FileUploader from '../components/FileUploader'
import Button from '../components/Button'
import Input from '../components/Input'
import Label from '../components/Label'
import Textarea from '../components/Textarea'
import { toast } from 'sonner'

export default function MovieUpload() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const isEditing = Boolean(editId)

  const [categories, setCategories] = useState<Category[]>([])
  const [genres, setGenres] = useState<Genre[]>([])

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [year, setYear] = useState('')
  const [description, setDescription] = useState('')
  const [imdbRating, setImdbRating] = useState('')
  const [badge, setBadge] = useState('')
  const [language, setLanguage] = useState('Urdu')
  const [dubsInput, setDubsInput] = useState('')
  const [isFree, setIsFree] = useState(false)
  const [sections, setSections] = useState<string[]>([])

  const [videoKey, setVideoKey] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [trailerKey, setTrailerKey] = useState('')
  const [trailerUrl, setTrailerUrl] = useState('')
  const [thumbnailKey, setThumbnailKey] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEditing)

  useEffect(() => {
    async function loadData() {
      const [catSnap, genreSnap] = await Promise.all([
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'genres')),
      ])
      setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category)))
      setGenres(genreSnap.docs.map(d => ({ id: d.id, ...d.data() } as Genre)))

      if (editId) {
        const movieSnap = await getDocs(collection(db, 'movies'))
        const movieDoc = movieSnap.docs.find(d => d.id === editId)
        if (movieDoc) {
          const m = movieDoc.data()
          setTitle(m.title || '')
          setCategory(m.category || '')
          setSelectedGenres(m.genres || [])
          setYear(String(m.year || ''))
          setDescription(m.description || '')
          setImdbRating(m.imdbRating ? String(m.imdbRating) : '')
          setBadge(m.badge || '')
          setLanguage(m.language || 'Urdu')
          setDubsInput((m.availableDubs || []).join(', '))
          setIsFree(m.isFree || false)
          setSections(m.sections || [])
          setVideoKey(m.videoKey || '')
          setVideoUrl(m.videoUrl || '')
          setTrailerKey(m.trailerKey || '')
          setTrailerUrl(m.trailerUrl || '')
          setThumbnailKey(m.thumbnailKey || '')
          setThumbnailUrl(m.thumbnailUrl || '')
        }
        setLoading(false)
      }
    }
    loadData()
  }, [editId])

  function toggleGenre(genreId: string) {
    setSelectedGenres(prev =>
      prev.includes(genreId) ? prev.filter(g => g !== genreId) : [...prev, genreId]
    )
  }

  function toggleSection(section: string) {
    setSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    )
  }

  async function handleSave() {
    if (!title.trim()) return toast.error('Title is required')
    if (!category) return toast.error('Category is required')
    if (selectedGenres.length === 0) return toast.error('At least one genre is required')
    if (!year || isNaN(Number(year)) || Number(year) < 1800) return toast.error('Valid release year is required')
    if (!isEditing && !videoKey) return toast.error('Video file is required')
    if (!isEditing && !thumbnailKey) return toast.error('Thumbnail is required')

    setSaving(true)
    try {
      const dubs = dubsInput.split(',').map(d => d.trim()).filter(Boolean)
      const movieData = {
        title: title.trim(),
        category,
        genres: selectedGenres,
        year: Number(year),
        description: description.trim(),
        imdbRating: imdbRating ? Number(imdbRating) : null,
        badge: badge.trim() || null,
        language: language.trim(),
        availableDubs: dubs,
        isFree,
        sections,
        videoKey,
        videoUrl,
        trailerKey: trailerKey || null,
        trailerUrl: trailerUrl || null,
        thumbnailKey,
        thumbnailUrl,
        paused: false,
        updatedAt: new Date().toISOString(),
      }

      if (isEditing && editId) {
        await updateDoc(doc(db, 'movies', editId), movieData)
        toast.success('Movie updated successfully')
      } else {
        await addDoc(collection(db, 'movies'), { ...movieData, createdAt: new Date().toISOString() })
        toast.success('Movie uploaded successfully')
      }
      navigate('/movies/list')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save movie')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Loading movie data...</p></div>
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{isEditing ? 'Edit Movie' : 'Upload New Movie'}</h1>
        <p className="text-sm text-gray-500 mt-1">{isEditing ? 'Update movie details and files' : 'Fill in the details and upload files for a new movie'}</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-3">Basic Info</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Movie title" />
          </div>
          <div className="space-y-1.5">
            <Label>Year of Release *</Label>
            <Input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. 2024" min="1800" max="2030" />
          </div>
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Input value={language} onChange={e => setLanguage(e.target.value)} placeholder="e.g. Urdu" />
          </div>
          <div className="space-y-1.5">
            <Label>IMDb Rating (optional)</Label>
            <Input type="number" step="0.1" min="0" max="10" value={imdbRating} onChange={e => setImdbRating(e.target.value)} placeholder="e.g. 8.5" />
          </div>
          <div className="space-y-1.5">
            <Label>Badge Emoji (optional)</Label>
            <Input value={badge} onChange={e => setBadge(e.target.value)} placeholder="e.g. 🔥" maxLength={4} />
            <p className="text-xs text-gray-400">Shown on top-right of thumbnail</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Movie description" rows={3} />
        </div>

        <div className="space-y-1.5">
          <Label>Available Dubs (optional, comma-separated)</Label>
          <Input value={dubsInput} onChange={e => setDubsInput(e.target.value)} placeholder="e.g. Hindi, English, Tamil" />
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="isFree" checked={isFree} onChange={e => setIsFree(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
          <Label htmlFor="isFree" className="cursor-pointer">Free movie (no payment required to watch)</Label>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-3">Genres *</h2>
        <div className="flex flex-wrap gap-2">
          {genres.map(g => (
            <button key={g.id} type="button" onClick={() => toggleGenre(g.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${selectedGenres.includes(g.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}>
              {g.name}
            </button>
          ))}
          {genres.length === 0 && <p className="text-sm text-gray-400">No genres added yet. Go to Genres page to add some.</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-3">Home Screen Sections</h2>
        <p className="text-sm text-gray-500">Assign this movie to any curated home screen shelf:</p>
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map(s => (
            <button key={s.value} type="button" onClick={() => toggleSection(s.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${sections.includes(s.value) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-3">Files</h2>

        <FileUploader label="Video File *" accept="video/mp4,video/x-matroska,video/webm"
          onUpload={(key, url) => { setVideoKey(key); setVideoUrl(url) }} />

        <FileUploader label="Trailer (optional)" accept="video/mp4,video/x-matroska,video/webm"
          onUpload={(key, url) => { setTrailerKey(key); setTrailerUrl(url) }} />

        <FileUploader label="Thumbnail *" accept="image/jpeg,image/png,image/webp"
          onUpload={(key, url) => { setThumbnailKey(key); setThumbnailUrl(url) }} />

        {videoKey && <p className="text-xs text-green-600">Video: {videoKey}</p>}
        {trailerKey && <p className="text-xs text-green-600">Trailer: {trailerKey}</p>}
        {thumbnailKey && <p className="text-xs text-green-600">Thumbnail: {thumbnailKey}</p>}
      </div>

      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => navigate('/movies/list')}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>{isEditing ? 'Update Movie' : 'Save Movie'}</Button>
      </div>
    </div>
  )
}