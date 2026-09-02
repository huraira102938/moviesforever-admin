import { useEffect, useState } from 'react'
import { collection, getDocs, doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { RedemptionCode } from '../lib/types'
import Button from '../components/Button'
import Badge from '../components/Badge'
import { toast } from 'sonner'

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

  async function loadCodes() {
    try {
      const snap = await getDocs(collection(db, 'codes'))
      const codeList = snap.docs.map(d => ({ id: d.id, ...d.data() } as RedemptionCode)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setCodes(codeList)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load codes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCodes() }, [])

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

  function copyAllCodes() {
    const unused = codes.filter(c => c.status === 'unused')
    const text = unused.map(c => `${c.id} | ${c.username}`).join('\n')
    navigator.clipboard.writeText(text)
    toast.success('All unused codes copied to clipboard')
  }

  const unusedCount = codes.filter(c => c.status === 'unused').length
  const usedCount = codes.filter(c => c.status === 'used').length

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Loading...</p></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Redemption Code Generator</h1>
        <p className="text-sm text-gray-500 mt-1">Generate unique redemption codes for paying users</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{codes.length}</p>
          <p className="text-sm text-gray-500">Total Codes</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{unusedCount}</p>
          <p className="text-sm text-gray-500">Unused</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{usedCount}</p>
          <p className="text-sm text-gray-500">Used</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Generate New Codes</h2>
        <div className="flex gap-3 items-end">
          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">Count</label>
            <input type="number" min="1" max="100" value={count} onChange={e => setCount(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <Button onClick={handleGenerate} loading={generating}>Generate</Button>
          <Button variant="outline" onClick={copyAllCodes}>Copy All Unused</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">All Codes</h3>
          <span className="text-sm text-gray-500">{codes.length} total</span>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Code ID</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Username</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Created</th>
            </tr>
          </thead>
          <tbody>
            {codes.map(code => (
              <tr key={code.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs">{code.id}</td>
                <td className="px-4 py-2.5 text-gray-700">{code.username}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={code.status === 'unused' ? 'success' : 'info'}>{code.status}</Badge>
                </td>
                <td className="px-4 py-2.5 text-gray-500">{new Date(code.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {codes.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">No codes generated yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}