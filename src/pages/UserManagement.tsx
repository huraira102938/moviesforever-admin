import { useEffect, useState } from 'react'
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AppUser } from '../lib/types'
import Badge from '../components/Badge'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from 'sonner'
import { Trash2, Search } from 'lucide-react'

export default function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)

  useEffect(() => {
    async function loadUsers() {
      try {
        const snap = await getDocs(collection(db, 'users'))
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()))
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

  const filtered = users.filter(u => {
    if (!search) return true
    const s = search.toLowerCase()
    return u.id.toLowerCase().includes(s) || u.username.toLowerCase().includes(s) || u.realName?.toLowerCase().includes(s) || u.phoneNumber?.includes(s)
  })

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
              <th className="text-left px-4 py-3 font-medium text-gray-500">JazzCash</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Referrals</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Referred By</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(user => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{user.id}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{user.username}</td>
                <td className="px-4 py-2.5 text-gray-700">{user.realName || '—'}</td>
                <td className="px-4 py-2.5 text-gray-600">{user.phoneNumber || '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="text-gray-600 text-xs">{user.jazzCashNumber || '—'}</div>
                  <div className="text-gray-400 text-xs">{user.jazzCashTitle || ''}</div>
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={user.referralCount > 0 ? 'success' : 'default'}>{user.referralCount || 0}</Badge>
                </td>
                <td className="px-4 py-2.5 text-gray-500">{user.referredBy || '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end">
                    <button onClick={() => setDeleteTarget(user)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal open={Boolean(deleteTarget)} title="Delete User" message={`Delete user "${deleteTarget?.username}" (${deleteTarget?.realName})? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} confirmLabel="Delete" />
    </div>
  )
}