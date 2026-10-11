import { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { RedemptionCode } from '../lib/types'
import Button from '../components/Button'
import Badge from '../components/Badge'
import ConfirmModal from '../components/ConfirmModal'
import { toast } from 'sonner'
import {
  RotateCcw,
  CheckCircle2,
  Copy,
  Check,
  Search,
  Trash2,
  Share2,
  X,
} from 'lucide-react'

function generateCodeString(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function generateUsername(): string {
  const adj = ['golden', 'silver', 'crimson', 'shadow', 'star', 'royal', 'elegant', 'bold', 'swift', 'fierce']
  const noun = ['lion', 'tiger', 'eagle', 'panther', 'hawk', 'wolf', 'dragon', 'phoenix', 'cobra', 'falcon']
  const a = adj[Math.floor(Math.random() * adj.length)]
  const n = noun[Math.floor(Math.random() * noun.length)]
  const num = Math.floor(Math.random() * 1000)
  return `${a}${n}${num}`
}

export default function CodeGenerator() {
  const [codes, setCodes] = useState<RedemptionCode[]>([])
  const [count, setCount] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unused' | 'used'>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RedemptionCode | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  async function loadCodes() {
    try {
      const snap = await getDocs(collection(db, 'codes'))
      const codeList = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as RedemptionCode))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setCodes(codeList)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load codes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCodes()
  }, [])

  async function handleGenerate() {
    if (count < 1 || count > 100) return toast.error('Enter between 1 and 100')
    setGenerating(true)
    try {
      const newCodes: RedemptionCode[] = []
      for (let i = 0; i < count; i++) {
        const id = generateCodeString()
        const username = generateUsername()
        const codeData = { id, username, status: 'unused' as const, createdAt: new Date().toISOString() }
        await setDoc(doc(db, 'codes', id), codeData)
        newCodes.push(codeData)
      }
      setCodes(prev => [...newCodes, ...prev])
      toast.success(`${count} codes generated`)
    } catch (err) {
      toast.error('Failed to generate codes')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSetStatus(code: RedemptionCode, newStatus: 'unused' | 'used') {
    setUpdatingId(code.id)
    try {
      const updateData: Record<string, any> = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      }
      if (newStatus === 'unused') {
        updateData.usedAt = deleteField()
      } else {
        updateData.usedAt = new Date().toISOString()
      }

      await updateDoc(doc(db, 'codes', code.id), updateData)

      setCodes(prev =>
        prev.map(c =>
          c.id === code.id
            ? {
                ...c,
                status: newStatus,
                usedAt: newStatus === 'unused' ? undefined : (updateData.usedAt as string),
                updatedAt: updateData.updatedAt as string,
              }
            : c
        )
      )
      toast.success(`Code "${code.id}" marked as ${newStatus}`)
    } catch (err) {
      console.error(err)
      toast.error(`Failed to mark code as ${newStatus}`)
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDeleteCode() {
    if (!deleteTarget) return
    try {
      await deleteDoc(doc(db, 'codes', deleteTarget.id))
      setCodes(prev => prev.filter(c => c.id !== deleteTarget.id))
      toast.success(`Code "${deleteTarget.id}" deleted`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete code')
    } finally {
      setDeleteTarget(null)
    }
  }

  function copyText(key: string, text: string, message: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success(message)
    setTimeout(() => {
      setCopiedKey(prev => (prev === key ? null : prev))
    }, 2000)
  }

  function copyAllCodes() {
    const unused = codes.filter(c => c.status === 'unused')
    const text = unused.map(c => `${c.id} | ${c.username}`).join('\n')
    navigator.clipboard.writeText(text)
    toast.success(`All ${unused.length} unused codes copied to clipboard`)
  }

  const unusedCount = codes.filter(c => c.status === 'unused').length
  const usedCount = codes.filter(c => c.status === 'used').length

  const filteredCodes = useMemo(() => {
    return codes.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase().trim()
      return c.id.toLowerCase().includes(q) || c.username.toLowerCase().includes(q)
    })
  }, [codes, statusFilter, search])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Redemption Code Generator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate unique redemption codes for paying users and manage their activation status.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`bg-white rounded-xl border p-4 text-center transition-all cursor-pointer ${
            statusFilter === 'all' ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-sm' : 'hover:border-gray-300'
          }`}
        >
          <p className="text-3xl font-bold text-gray-900">{codes.length}</p>
          <p className="text-sm text-gray-500 flex items-center justify-center gap-1 mt-1">
            Total Codes
            {statusFilter === 'all' && <span className="text-xs text-indigo-600 font-semibold">• Active</span>}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('unused')}
          className={`bg-white rounded-xl border p-4 text-center transition-all cursor-pointer ${
            statusFilter === 'unused' ? 'ring-2 ring-green-500 border-green-500 shadow-sm' : 'hover:border-gray-300'
          }`}
        >
          <p className="text-3xl font-bold text-green-600">{unusedCount}</p>
          <p className="text-sm text-gray-500 flex items-center justify-center gap-1 mt-1">
            Unused Codes
            {statusFilter === 'unused' && <span className="text-xs text-green-600 font-semibold">• Active</span>}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('used')}
          className={`bg-white rounded-xl border p-4 text-center transition-all cursor-pointer ${
            statusFilter === 'used' ? 'ring-2 ring-blue-500 border-blue-500 shadow-sm' : 'hover:border-gray-300'
          }`}
        >
          <p className="text-3xl font-bold text-blue-600">{usedCount}</p>
          <p className="text-sm text-gray-500 flex items-center justify-center gap-1 mt-1">
            Used Codes
            {statusFilter === 'used' && <span className="text-xs text-blue-600 font-semibold">• Active</span>}
          </p>
        </button>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Generate New Codes</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">Count</label>
            <input
              type="number"
              min="1"
              max="100"
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Button onClick={handleGenerate} loading={generating}>
            Generate
          </Button>
          <Button variant="outline" onClick={copyAllCodes}>
            Copy All Unused ({unusedCount})
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">All Codes</h3>
            <span className="text-xs text-gray-500">
              Showing {filteredCodes.length} of {codes.length} total
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search code or username..."
                className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 border border-gray-300 rounded-lg p-0.5 bg-white text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unused')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'unused' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Unused ({unusedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('used')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'used' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Used ({usedCount})
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Code ID</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Username</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">Created</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCodes.map(code => {
                const isUpdating = updatingId === code.id
                const isCodeCopied = copiedKey === `id-${code.id}`
                const isUserCopied = copiedKey === `user-${code.id}`
                const isBothCopied = copiedKey === `both-${code.id}`

                return (
                  <tr key={code.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-gray-800">
                        <span>{code.id}</span>
                        <button
                          type="button"
                          onClick={() => copyText(`id-${code.id}`, code.id, `Code "${code.id}" copied`)}
                          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 cursor-pointer"
                          title="Copy Code ID"
                        >
                          {isCodeCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <span className="font-medium">{code.username}</span>
                        <button
                          type="button"
                          onClick={() => copyText(`user-${code.id}`, code.username, `Username "${code.username}" copied`)}
                          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 cursor-pointer"
                          title="Copy Username"
                        >
                          {isUserCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <Badge variant={code.status === 'unused' ? 'success' : 'info'}>
                          {code.status}
                        </Badge>
                        {code.status === 'used' && code.usedAt && (
                          <div className="text-[11px] text-gray-400">
                            Used: {new Date(code.usedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {new Date(code.createdAt).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {code.status === 'used' ? (
                          <button
                            type="button"
                            onClick={() => handleSetStatus(code, 'unused')}
                            disabled={isUpdating}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                            title="Reset code status to unused so user can redeem again"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                            {isUpdating ? 'Updating...' : 'Make Unused'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetStatus(code, 'used')}
                            disabled={isUpdating}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors disabled:opacity-50 cursor-pointer"
                            title="Mark this code as used"
                          >
                            <CheckCircle2 className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                            {isUpdating ? 'Updating...' : 'Mark Used'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              `both-${code.id}`,
                              `Code: ${code.id}\nUsername: ${code.username}`,
                              `Credentials for "${code.username}" copied to clipboard`
                            )
                          }
                          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-500 hover:text-indigo-600 transition-colors cursor-pointer"
                          title="Copy Code & Username for user"
                        >
                          {isBothCopied ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Share2 className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(code)}
                          className="p-1.5 rounded-lg border border-gray-200 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="Delete Code"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredCodes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    {search || statusFilter !== 'all' ? (
                      <div className="space-y-2">
                        <p>No codes match your search or filter.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('')
                            setStatusFilter('all')
                          }}
                          className="text-xs text-indigo-600 hover:underline font-medium cursor-pointer"
                        >
                          Clear filters
                        </button>
                      </div>
                    ) : (
                      'No codes generated yet'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Redemption Code"
        message={`Are you sure you want to delete code "${deleteTarget?.id}" (${deleteTarget?.username})? This cannot be undone.`}
        onConfirm={handleDeleteCode}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
      />
    </div>
  )
}