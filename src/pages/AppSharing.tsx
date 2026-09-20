import { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import Button from '../components/Button'
import Input from '../components/Input'
import Label from '../components/Label'
import FileUploader from '../components/FileUploader'
import Badge from '../components/Badge'
import { toast } from 'sonner'
import { Trash2, Share2, ExternalLink, Package } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

interface AppLink {
  id: string
  title: string
  apkUrl?: string
  apkFileKey?: string
  apkFileUrl?: string
  apkFileName?: string
  apkFileSize?: number
  version?: string
  createdAt: string
}

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function AppSharing() {
  const [links, setLinks] = useState<AppLink[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [apkUrl, setApkUrl] = useState('')
  const [version, setVersion] = useState('')
  const [apkFileKey, setApkFileKey] = useState('')
  const [apkFileUrl, setApkFileUrl] = useState('')
  const [apkFileName, setApkFileName] = useState('')
  const [apkFileSize, setApkFileSize] = useState<number | undefined>(undefined)
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

  function resetForm() {
    setTitle('')
    setApkUrl('')
    setVersion('')
    setApkFileKey('')
    setApkFileUrl('')
    setApkFileName('')
    setApkFileSize(undefined)
  }

  async function handleAdd() {
    if (!title.trim()) return toast.error('Title is required')
    if (!apkUrl.trim() && !apkFileKey) return toast.error('Add a download link or upload an APK file')

    setSaving(true)
    try {
      const docRef = await addDoc(collection(db, 'app-sharing'), {
        title: title.trim(),
        apkUrl: apkUrl.trim() || null,
        version: version.trim() || null,
        apkFileKey: apkFileKey || null,
        apkFileUrl: apkFileUrl || null,
        apkFileName: apkFileName || null,
        apkFileSize: apkFileSize ?? null,
        createdAt: new Date().toISOString(),
      })
      setLinks(prev => [{
        id: docRef.id,
        title: title.trim(),
        apkUrl: apkUrl.trim() || undefined,
        version: version.trim() || undefined,
        apkFileKey: apkFileKey || undefined,
        apkFileUrl: apkFileUrl || undefined,
        apkFileName: apkFileName || undefined,
        apkFileSize: apkFileSize,
        createdAt: new Date().toISOString(),
      }, ...prev])
      resetForm()
      toast.success('App entry added')
    } catch (err) {
      console.error(err)
      toast.error('Failed to add app entry')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'app-sharing', deleteTarget.id))
      setLinks(prev => prev.filter(l => l.id !== deleteTarget.id))
      toast.success('App entry deleted')
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
        <p className="text-sm text-gray-500 mt-1">Manage the download link shown in the mobile app and the APK file served on the landing page</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-5">
        <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 rounded-lg p-3">
          <Share2 className="w-5 h-5" />
          <p className="text-sm">Add the Google Drive link for the mobile app and/or upload the APK file for a direct download on the landing page.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Title *</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. MoviesForever APK" />
        </div>
        <div className="space-y-1.5">
          <Label>Google Drive / Download Link (optional)</Label>
          <Input value={apkUrl} onChange={e => setApkUrl(e.target.value)} placeholder="Paste Google Drive link here (shown in the mobile app)" />
        </div>
        <div className="space-y-1.5">
          <Label>Version (optional)</Label>
          <Input value={version} onChange={e => setVersion(e.target.value)} placeholder="e.g. v1.0.2" />
        </div>
        <div className="space-y-2">
          <FileUploader
            label="APK File (optional)"
            accept=".apk,application/vnd.android.package-archive"
            onUpload={(key, url, size) => {
              setApkFileKey(key)
              setApkFileUrl(url)
              setApkFileName(key.slice(0, key.lastIndexOf('-')) + '.apk')
              setApkFileSize(size)
            }}
            onClear={() => {
              setApkFileKey('')
              setApkFileUrl('')
              setApkFileName('')
              setApkFileSize(undefined)
            }}
          />
          {apkFileKey && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Package className="w-4 h-4 text-green-600" />
              <span className="truncate flex-1">{apkFileName}</span>
              <span className="text-xs text-gray-400">{formatSize(apkFileSize)}</span>
            </div>
          )}
        </div>

        <Button onClick={handleAdd} loading={saving} disabled={!title.trim() || (!apkUrl.trim() && !apkFileKey)}>
          <Share2 className="w-4 h-4 mr-2" /> Add App Entry
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">App Entries ({links.length})</h2>
        {links.length === 0 && <p className="text-sm text-gray-400">No app entries yet</p>}
        {links.map(link => {
          const downloadUrl = link.apkFileUrl || link.apkUrl
          return (
            <div key={link.id} className="bg-white rounded-xl border p-4 flex items-center gap-4">
              {link.apkFileUrl ? <Package className="w-5 h-5 text-green-500 shrink-0" /> : <Share2 className="w-5 h-5 text-indigo-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-900">{link.title} {link.version && <span className="text-xs text-gray-400">({link.version})</span>}</p>
                  {link.apkFileUrl && <Badge variant="success">APK File</Badge>}
                  {link.apkUrl && <Badge variant="info">In-app Link</Badge>}
                </div>
                <p className="text-xs text-gray-400 break-all mt-0.5">
                  {link.apkFileName ? `${link.apkFileName}${link.apkFileSize ? ` · ${formatSize(link.apkFileSize)}` : ''}` : ''}
                  {link.apkUrl && `${link.apkFileName ? ' — ' : ''}${link.apkUrl}`}
                </p>
              </div>
              {downloadUrl && (
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
                  <ExternalLink className="w-3.5 h-3.5" /> Open
                </a>
              )}
              <button onClick={() => setDeleteTarget(link)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          )
        })}
      </div>

      <ConfirmModal open={Boolean(deleteTarget)} title="Delete App Entry" message={`Delete "${deleteTarget?.title}"?`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} confirmLabel="Delete" />
    </div>
  )
}