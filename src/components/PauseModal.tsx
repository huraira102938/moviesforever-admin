import { useEffect, useState } from 'react'
import { PauseCircle, X } from 'lucide-react'
import Button from './Button'

interface PauseModalProps {
  open: boolean
  username: string
  onConfirm: (userNote: string, adminNote: string) => void
  onCancel: () => void
  saving?: boolean
}

export default function PauseModal({ open, username, onConfirm, onCancel, saving }: PauseModalProps) {
  const [userNote, setUserNote] = useState('')
  const [adminNote, setAdminNote] = useState('')

  useEffect(() => {
    if (open) {
      setUserNote('')
      setAdminNote('')
      const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg flex items-center gap-2 text-amber-900">
            <PauseCircle className="w-5 h-5" />
            Pause User
          </h3>
          <button onClick={onCancel} className="hover:text-gray-500"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-amber-800 mb-5">
          Pausing <strong>{username}</strong> will block their access until resumed. Both notes are required.
        </p>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-amber-900">Note for the User *</label>
            <textarea
              value={userNote}
              onChange={e => setUserNote(e.target.value)}
              placeholder="Shown directly to the user, e.g. Your account is paused because of a reported issue. Contact support for details."
              rows={3}
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-amber-900">Note for Admin (internal) *</label>
            <textarea
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
              placeholder="Internal notes only, e.g. Failed identity verification, requested chargeback on 12 Sep."
              rows={3}
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border bg-white text-sm hover:bg-gray-50">Cancel</button>
          <Button onClick={() => onConfirm(userNote.trim(), adminNote.trim())} loading={saving} disabled={!userNote.trim() || !adminNote.trim()} className="bg-amber-600 hover:bg-amber-700">
            Pause User
          </Button>
        </div>
      </div>
    </div>
  )
}