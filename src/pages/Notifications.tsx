import { useEffect, useState } from 'react'
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AppUser, PaymentTransaction, AppNotification, NotificationTarget } from '../lib/types'
import Button from '../components/Button'
import ConfirmModal from '../components/ConfirmModal'
import Badge from '../components/Badge'
import { toast } from 'sonner'
import { Send, Trash2 } from 'lucide-react'

const TARGET_OPTIONS: { value: NotificationTarget; label: string }[] = [
  { value: 'free', label: 'Free Users' },
  { value: 'paid', label: 'Paid Users' },
  { value: 'paused', label: 'Paused Users' },
]

export default function Notifications() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const [text, setText] = useState('')
  const [targets, setTargets] = useState<NotificationTarget[]>([])
  const [sending, setSending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AppNotification | null>(null)

  async function loadData() {
    try {
      const [userSnap, txnSnap, notifSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'transactions')),
        getDocs(collection(db, 'notifications')),
      ])
      setUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)))
      setTransactions(txnSnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentTransaction)))
      setNotifications(
        notifSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as AppNotification))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      )
    } catch (err) {
      console.error(err)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const paidUserIds = new Set(transactions.map(t => t.clientUserId))
  const targetCounts = {
    free: users.filter(u => !paidUserIds.has(u.id) && !u.paused).length,
    paid: users.filter(u => paidUserIds.has(u.id) && !u.paused).length,
    paused: users.filter(u => u.paused).length,
  }
  const totalReach = targets.reduce((s, t) => s + targetCounts[t], 0)

  function toggleTarget(t: NotificationTarget) {
    setTargets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return toast.error('Enter notification text')
    if (targets.length === 0) return toast.error('Select at least one user group')

    setSending(true)
    try {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const notif: AppNotification = { id, text: trimmed, targets, createdAt: new Date().toISOString() }
      await setDoc(doc(db, 'notifications', id), notif)
      setNotifications(prev => [notif, ...prev])
      setText('')
      setTargets([])
      toast.success('Notification sent')
    } catch (err) {
      toast.error('Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'notifications', deleteTarget.id))
      setNotifications(prev => prev.filter(n => n.id !== deleteTarget.id))
      toast.success('Notification deleted')
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
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500 mt-1">Send in-app notifications to user groups</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-900">Notification Text *</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type your notification message here..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-900">Target Users * (select at least one)</label>
          <div className="flex flex-wrap gap-2">
            {TARGET_OPTIONS.map(opt => {
              const selected = targets.includes(opt.value)
              const count = targetCounts[opt.value]
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleTarget(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {opt.label}
                  <span className={`ml-2 text-xs ${selected ? 'text-indigo-200' : 'text-gray-400'}`}>
                    ({count})
                  </span>
                </button>
              )
            })}
          </div>
          {targets.length > 0 && (
            <p className="text-xs text-gray-500">Will reach <strong>{totalReach}</strong> users</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSend} loading={sending} disabled={!text.trim() || targets.length === 0}>
            <Send className="w-4 h-4 mr-2" /> Send Notification
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">Sent Notifications</h3>
        </div>
        {notifications.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-gray-400">No notifications sent yet</p>
        ) : (
          <div className="divide-y">
            {notifications.map(notif => (
              <div key={notif.id} className="px-4 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{notif.text}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {notif.targets.map(t => <Badge key={t} variant={t === 'paused' ? 'warning' : t === 'paid' ? 'success' : 'default'}>{t} ({targetCounts[t]})</Badge>)}
                    <span className="text-xs text-gray-400 ml-1">{new Date(notif.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <button onClick={() => setDeleteTarget(notif)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Notification"
        message="Delete this notification from the list?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
      />
    </div>
  )
}