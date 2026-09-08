import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import Button from '../components/Button'
import Input from '../components/Input'
import Label from '../components/Label'
import { toast } from 'sonner'
import { Trash2, Share2, ExternalLink } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

interface AppLink {
  id: string
  title: string
  apkUrl: string
  version?: string
  createdAt: string
}

export default function AppSharing() {
  const [links, setLinks] = useState<AppLink[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [apkUrl, setApkUrl] = useState('')
  const [version, setVersion] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AppLink | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(collection(db, 'app-sharing'))
        setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppLink)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      } catch (err) {
        console.error(err)
        toast.error('Failed to load app links')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleAdd() {
    if (!title.trim()) return toast.error('Title is required')
    if (!apkUrl.trim()) return toast.error('APK / download link is required')

    setSaving(true)
    try {
      const docRef = await addDoc(collection(db, 'app-sharing'), {
        title: title.trim(),
        apkUrl: apkUrl.trim(),
        version: version.trim() || null,
        createdAt: new Date().toISOString(),
      })
      setLinks(prev => [{ id: docRef.id, title: title.trim(), apkUrl: apkUrl.trim(), version: version.trim() || undefined, createdAt: new Date().toISOString() }, ...prev])
      setTitle('')
      setApkUrl('')
      setVersion('')
      toast.success('App link added')
    } catch (err) {
      console.error(err)
      toast.error('Failed to add app link')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'app-sharing', deleteTarget.id))
      setLinks(prev => prev.filter(l => l.id !== deleteTarget.id))
      toast.success('App link deleted')
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">App Sharing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage the app download link (APK) shared with users</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-5">
        <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 rounded-lg p-3">
          <Share2 className="w-5 h-5" />
          <p className="text-sm">Add the Google Drive (or any) download link. This link will be shown for sharing the app.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Title *</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. MoviesForever APK" />
        </div>
        <div className="space-y-1.5">
          <Label>APK / Download Link *</Label>
          <Input value={apkUrl} onChange={e => setApkUrl(e.target.value)} placeholder="Paste Google Drive link here" />
        </div>
        <div className="space-y-1.5">
          <Label>Version (optional)</Label>
          <Input value={version} onChange={e => setVersion(e.target.value)} placeholder="e.g. v1.0.2" />
        </div>

        <Button onClick={handleAdd} loading={saving} disabled={!title.trim() || !apkUrl.trim()}>
          <Share2 className="w-4 h-4 mr-2" /> Add App Link
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">App Links ({links.length})</h2>
        {links.length === 0 && <p className="text-sm text-gray-400">No app links yet</p>}
        {links.map(link => (
          <div key={link.id} className="bg-white rounded-xl border p-4 flex items-center gap-4">
            <Share2 className="w-5 h-5 text-indigo-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{link.title} {link.version && <span className="text-xs text-gray-400">({link.version})</span>}</p>
              <p className="text-xs text-gray-400 break-all">{link.apkUrl}</p>
            </div>
            <a href={link.apkUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
              <ExternalLink className="w-3.5 h-3.5" /> Open
            </a>
            <button onClick={() => setDeleteTarget(link)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      <ConfirmModal open={Boolean(deleteTarget)} title="Delete App Link" message={`Delete "${deleteTarget?.title}"?`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} confirmLabel="Delete" />
    </div>
  )
}
