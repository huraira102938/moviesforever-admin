import { useState, useRef } from 'react'
import { uploadToR2 } from '../lib/r2'
import { Upload, X, CheckCircle, Image as ImageIcon } from 'lucide-react'

interface FileUploaderProps {
  onUpload: (key: string, publicUrl: string) => void
  accept?: string
  label: string
  showPreview?: boolean
}

export default function FileUploader({ onUpload, accept = 'video/*', label, showPreview = true }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedKey, setUploadedKey] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null
    setFile(f)
    setUploadedKey(null)
    setError(null)
    if (f && showPreview && f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError(null)
    setProgress(0)
    try {
      const ext = file.name.slice(file.name.lastIndexOf('.'))
      const base = file.name.replace(/\.[^/.]+$/, '').substring(0, 50)
      const key = `${base}-${Date.now()}${ext}`
      await uploadToR2(file, key, (loaded, total) => {
        setProgress(Math.round((loaded / total) * 100))
      })
      const publicUrl = `${import.meta.env.VITE_R2_PUBLIC_URL}/${key}`
      setUploadedKey(key)
      setFile(null)
      setPreview(null)
      if (inputRef.current) inputRef.current.value = ''
      onUpload(key, publicUrl)
    } catch (err: any) {
      console.error('Upload failed:', err)
      const msg = err?.message || ''
      let friendly = 'Upload failed. Please try again.'
      if (msg.includes('CORS') || msg.includes('blocked') || msg.includes('Failed to fetch')) {
        friendly = 'CORS error: R2 bucket CORS policy needs to allow PUT & multipart. Check Cloudflare R2 CORS settings.'
      } else if (msg.includes('AccessDenied')) {
        friendly = 'Access denied: R2 API token lacks write permission for this bucket.'
      } else if (msg.includes('SignatureDoesNotMatch')) {
        friendly = 'Credential error: R2 access key or secret is incorrect.'
      } else if (msg.includes('expired') || msg.includes('timed out')) {
        friendly = 'Upload timed out. This can happen with very large files and slow connections.'
      } else if (err?.message) {
        friendly = `Upload failed: ${err.message.substring(0, 200)}`
      }
      setError(friendly)
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    setFile(null)
    setUploadedKey(null)
    setPreview(null)
    setProgress(0)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const isImage = file?.type.startsWith('image/') || accept.includes('image/')

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {preview && (
        <div className="relative inline-block">
          <img src={preview} alt="Preview" className="w-full max-w-xs h-32 rounded-lg object-cover border" />
          <button type="button" onClick={handleRemove} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {uploadedKey && !file && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-700 flex-1 truncate">Uploaded successfully</span>
          <button type="button" onClick={handleRemove} className="text-green-600 hover:text-red-500 text-xs">Remove</button>
        </div>
      )}

      {!preview && !uploadedKey && (
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFileSelect} />
      )}

      {!preview && !uploadedKey && (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-indigo-500 hover:text-indigo-600 transition-colors">
          <Upload className="w-4 h-4" />
          {isImage ? 'Choose Image' : 'Choose File'}
        </button>
      )}

      {file && !uploadedKey && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="flex-1 truncate">{file.name}</span>
            <span className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
          </div>
          {uploading && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={handleUpload} disabled={uploading}
              className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {uploading ? `Uploading ${progress}%` : 'Upload'}
            </button>
            <button type="button" onClick={handleRemove} className="px-3 py-1.5 text-red-500 text-sm rounded-lg hover:bg-red-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}