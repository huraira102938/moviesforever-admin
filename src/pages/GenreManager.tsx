import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Genre } from '../lib/types'
import Button from '../components/Button'
import Input from '../components/Input'
import { toast } from 'sonner'
import { Edit, Trash2 } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

export default function GenreManager() {
  const [genres, setGenres] = useState<Genre[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Genre | null>(null)

  async function loadGenres() {
    try {
      const snap = await getDocs(collection(db, 'genres'))
      setGenres(snap.docs.map(d => ({ id: d.id, ...d.data() } as Genre)).sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      console.error(err)
      toast.error('Failed to load genres')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadGenres() }, [])

  async function handleAdd() {
    if (!newName.trim()) return toast.error('Name is required')
    if (genres.some(g => g.name.toLowerCase() === newName.trim().toLowerCase())) return toast.error('Genre already exists')
    setSaving(true)
    try {
      const docRef = await addDoc(collection(db, 'genres'), { name: newName.trim() })
      setGenres(prev => [...prev, { id: docRef.id, name: newName.trim() }].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      toast.success('Genre added')
    } catch (err) {
      toast.error('Failed to add genre')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(genre: Genre) {
    if (!editName.trim()) return toast.error('Name is required')
    try {
      await updateDoc(doc(db, 'genres', genre.id), { name: editName.trim() })
      setGenres(prev => prev.map(g => g.id === genre.id ? { ...g, name: editName.trim() } : g).sort((a, b) => a.name.localeCompare(b.name)))
      setEditId(null)
      setEditName('')
      toast.success('Genre updated')
    } catch (err) {
      toast.error('Failed to update')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'genres', deleteTarget.id))
      setGenres(prev => prev.filter(g => g.id !== deleteTarget.id))
      toast.success('Genre deleted')
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
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Genre Management</h1>
        <p className="text-sm text-gray-500 mt-1">Manage movie genres (movies can have multiple genres)</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Add New Genre</h2>
        <div className="flex gap-3">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Genre name (e.g. Thriller)" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <Button onClick={handleAdd} loading={saving}>Add</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {genres.map(genre => (
              <tr key={genre.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  {editId === genre.id ? (
                    <div className="flex gap-2">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUpdate(genre)} className="h-8" />
                      <Button size="sm" onClick={() => handleUpdate(genre)}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditId(null); setEditName('') }}>Cancel</Button>
                    </div>
                  ) : (
                    <span className="font-medium text-gray-900">{genre.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editId !== genre.id && (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditId(genre.id); setEditName(genre.name) }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-indigo-600"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(genre)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {genres.length === 0 && (
              <tr><td colSpan={2} className="px-4 py-12 text-center text-gray-400">No genres yet. Add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal open={Boolean(deleteTarget)} title="Delete Genre" message={`Delete "${deleteTarget?.name}"? Movies tagged with this genre won't be deleted.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} confirmLabel="Delete" />
    </div>
  )
}