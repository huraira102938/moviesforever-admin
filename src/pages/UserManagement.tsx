import { useEffect, useState } from 'react'
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AppUser, PaymentTransaction } from '../lib/types'
import Badge from '../components/Badge'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from 'sonner'
import { Trash2, Search, ChevronDown, ChevronUp, CheckCircle2, Wallet, CircleDollarSign } from 'lucide-react'

export default function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadUsers() {
      try {
        const [userSnap, txnSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'transactions')),
        ])
        setUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()))
        setTransactions(txnSnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentTransaction)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      } catch (err) {
        console.error(err)
        toast.error('Failed to load users')
      } finally {
        setLoading(false)
      }
    }
    loadUsers()
  }, [])

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'users', deleteTarget.id))
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
      toast.success('User deleted')
    } catch (err) {
      toast.error('Failed to delete')
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleMarkPaid(txn: PaymentTransaction) {
    try {
      await updateDoc(doc(db, 'transactions', txn.id), {
        status: 'paid',
        paidAt: new Date().toISOString(),
      })
      setTransactions(prev => prev.map(t => t.id === txn.id ? { ...t, status: 'paid', paidAt: new Date().toISOString() } : t))
      toast.success('Payout marked as paid')
    } catch (err) {
      toast.error('Failed to update payout')
    }
  }

  const filtered = users.filter(u => {
    if (!search) return true
    const s = search.toLowerCase()
    return u.id.toLowerCase().includes(s) || u.username.toLowerCase().includes(s) || u.realName?.toLowerCase().includes(s) || u.phoneNumber?.includes(s)
  })

  function referrerTxns(username: string) {
    return transactions.filter(t => t.referralUsername === username)
  }

  function userTxns(userId: string) {
    return transactions.filter(t => t.clientUserId === userId)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Loading...</p></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-sm text-gray-500 mt-1">{users.length} registered users</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ID, username, name, or phone..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">User ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Username</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Referrals</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Pending Payout</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(user => {
              const rTxns = referrerTxns(user.username)
              const totalPending = rTxns.filter(t => t.status === 'pending').reduce((s, t) => s + t.referrerPendingAmount, 0)
              const totalCompleted = rTxns.filter(t => t.status === 'paid').reduce((s, t) => s + t.referrerPendingAmount, 0)
              const totalReceived = rTxns.reduce((s, t) => s + t.totalReceived, 0)
              const isOpen = expanded[user.id]
              return (
                <FragmentRow
                  key={user.id}
                  user={user}
                  rTxns={rTxns}
                  isOpen={isOpen}
                  totalPending={totalPending}
                  totalCompleted={totalCompleted}
                  totalReceived={totalReceived}
                  onToggle={() => setExpanded(prev => ({ ...prev, [user.id]: !prev[user.id] }))}
                  onDelete={() => setDeleteTarget(user)}
                  onMarkPaid={handleMarkPaid}
                />
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal open={Boolean(deleteTarget)} title="Delete User" message={`Delete user "${deleteTarget?.username}" (${deleteTarget?.realName})? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} confirmLabel="Delete" />
    </div>
  )
}

function FragmentRow({
  user, rTxns, isOpen, totalPending, totalCompleted, totalReceived, onToggle, onDelete, onMarkPaid,
}: {
  user: AppUser
  rTxns: PaymentTransaction[]
  isOpen: boolean
  totalPending: number
  totalCompleted: number
  totalReceived: number
  onToggle: () => void
  onDelete: () => void
  onMarkPaid: (txn: PaymentTransaction) => void
}) {
  return (
    <>
      <tr className={`border-b hover:bg-gray-50 ${isOpen ? 'bg-gray-50' : ''}`}>
        <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{user.id}</td>
        <td className="px-4 py-2.5 font-medium text-gray-900">{user.username}</td>
        <td className="px-4 py-2.5 text-gray-700">{user.realName || '—'}</td>
        <td className="px-4 py-2.5 text-gray-600">
          {user.phoneNumber || '—'}
          {user.paymentNumber ? <div className="text-xs text-gray-400">{user.paymentNumber} · {user.accountTitle || ''} · {user.paymentMethod}</div> : null}
        </td>
        <td className="px-4 py-2.5">
          <Badge variant={user.referralCount > 0 ? 'success' : 'default'}>{user.referralCount || 0}</Badge>
        </td>
        <td className="px-4 py-2.5">
          {totalPending > 0
            ? <Badge variant="warning">PKR {totalPending} pending</Badge>
            : <span className="text-gray-400">—</span>}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center justify-end gap-1">
            {(rTxns.length > 0 || user.referralCount > 0) && (
              <button onClick={onToggle} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-indigo-600" title="View payments">
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
            <button onClick={onDelete} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-gray-50/50">
          <td colSpan={7} className="px-4 py-4">
            <DetailPanel
              username={user.username}
              rTxns={rTxns}
              totalPending={totalPending}
              totalCompleted={totalCompleted}
              totalReceived={totalReceived}
              onMarkPaid={onMarkPaid}
            />
          </td>
        </tr>
      )}
    </>
  )
}

function DetailPanel({
  username, rTxns, totalPending, totalCompleted, totalReceived, onMarkPaid,
}: {
  username: string
  rTxns: PaymentTransaction[]
  totalPending: number
  totalCompleted: number
  totalReceived: number
  onMarkPaid: (txn: PaymentTransaction) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Wallet className="w-4 h-4" />
        <span>Referral earnings for <strong className="text-gray-900">{username}</strong></span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <CircleDollarSign className="w-4 h-4 text-amber-500" />
            Total Pending
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-1">PKR {totalPending}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Total Completed
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-1">PKR {totalCompleted}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Wallet className="w-4 h-4 text-indigo-500" />
            Total Received (via {username})
          </div>
          <p className="text-2xl font-bold text-indigo-600 mt-1">PKR {totalReceived}</p>
        </div>
      </div>

      {rTxns.length === 0 ? (
        <p className="text-sm text-gray-400">No referral transactions yet.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">Date</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">Client</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">Total Received</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">Pending Payout</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">Status</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {rTxns.map(txn => (
                <tr key={txn.id} className="border-b last:border-0">
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{new Date(txn.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-gray-900">{txn.clientRealName} <span className="text-xs text-gray-400">({txn.clientUsername})</span></p>
                    <p className="text-xs text-gray-400">{txn.clientPhoneNumber} · {(txn.paymentMethod || '').charAt(0).toUpperCase() + (txn.paymentMethod || '').slice(1)} {txn.paymentNumber || txn.clientJazzCashNumber}</p>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 font-medium">PKR {txn.totalReceived}</td>
                  <td className="px-3 py-2.5 text-gray-700">PKR {txn.referrerPendingAmount}</td>
                  <td className="px-3 py-2.5">
                    {txn.status === 'paid'
                      ? <Badge variant="success">Paid</Badge>
                      : <Badge variant="warning">Pending</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {txn.status === 'pending' && (
                      <button
                        onClick={() => onMarkPaid(txn)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark as Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
