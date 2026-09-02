import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Category } from '../lib/types'
import Button from '../components/Button'
import Input from '../components/Input'
import { toast } from 'sonner'
import { Edit, Trash2 } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  async function loadCategories() {
    try {
      const snap = await getDocs(collection(db, 'categories'))
      const cats = snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)).sort((a, b) => a.order - b.order)
      setCategories(cats)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCategories() }, [])

  async function handleAdd() {
    if (!newName.trim()) return toast.error('Name is required')
    if (categories.some(c => c.name.toLowerCase() === newName.trim().toLowerCase())) return toast.error('Category already exists')
    setSaving(true)
    try {
      const order = categories.length
      const docRef = await addDoc(collection(db, 'categories'), { name: newName.trim(), order })
      setCategories(prev => [...prev, { id: docRef.id, name: newName.trim(), order }].sort((a, b) => a.order - b.order))
      setNewName('')
      toast.success('Category added')
    } catch (err) {
      toast.error('Failed to add category')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(cat: Category) {
    if (!editName.trim()) return toast.error('Name is required')
    try {
      await updateDoc(doc(db, 'categories', cat.id), { name: editName.trim() })
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: editName.trim() } : c))
      setEditId(null)
      setEditName('')
      toast.success('Category updated')
    } catch (err) {
      toast.error('Failed to update')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'categories', deleteTarget.id))
      setCategories(prev => prev.filter(c => c.id !== deleteTarget.id))
      toast.success('Category deleted')
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
        <h1 className="text-2xl font-bold text-gray-900">Category Management</h1>
        <p className="text-sm text-gray-500 mt-1">Add, edit, or remove movie categories</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Add New Category</h2>
        <div className="flex gap-3">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Category name (e.g. Bollywood)" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <Button onClick={handleAdd} loading={saving}>Add</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">#</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, i) => (
              <tr key={cat.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                <td className="px-4 py-3">
                  {editId === cat.id ? (
                    <div className="flex gap-2">
                      <Input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUpdate(cat)} className="h-8" />
                      <Button size="sm" onClick={() => handleUpdate(cat)}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditId(null); setEditName('') }}>Cancel</Button>
                    </div>
                  ) : (
                    <span className="font-medium text-gray-900">{cat.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editId !== cat.id && (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditId(cat.id); setEditName(cat.name) }} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-indigo-600"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteTarget(cat)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-gray-400">No categories yet. Add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal open={Boolean(deleteTarget)} title="Delete Category" message={`Delete "${deleteTarget?.name}"? Movies using this category won't be deleted.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} confirmLabel="Delete" />
    </div>
  )
}