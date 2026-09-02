import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { toast } from 'sonner'

interface ReferralClaim {
  id: string
  referrerUsername: string
  newUser: string
  newUsername?: string
  timestamp: string
}

export default function ReferralTracking() {
  const [claims, setClaims] = useState<ReferralClaim[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadClaims() {
      try {
        const snap = await getDocs(collection(db, 'referral-claims'))
        const claimList = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReferralClaim)).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setClaims(claimList)
      } catch (err) {
        console.error(err)
        toast.error('Failed to load referral claims')
      } finally {
        setLoading(false)
      }
    }
    loadClaims()
  }, [])

  const referrerStats = claims.reduce<Record<string, number>>((acc, c) => {
    acc[c.referrerUsername] = (acc[c.referrerUsername] || 0) + 1
    return acc
  }, {})

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Loading...</p></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Referral Tracking</h1>
        <p className="text-sm text-gray-500 mt-1">View all referral claims and top referrers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Top Referrers</h2>
          {Object.keys(referrerStats).length === 0 ? (
            <p className="text-sm text-gray-400">No referrals yet</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(referrerStats).sort(([, a], [, b]) => b - a).slice(0, 10).map(([username, count]) => (
                <div key={username} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium text-gray-900">{username}</span>
                  <span className="text-sm bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full">{count} referral{count > 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-gray-500">Total Claims</span><span className="font-semibold">{claims.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Unique Referrers</span><span className="font-semibold">{Object.keys(referrerStats).length}</span></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">All Referral Claims</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Referrer</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">New User ID</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">New Username</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody>
            {claims.map(claim => (
              <tr key={claim.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{claim.referrerUsername}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{claim.newUser}</td>
                <td className="px-4 py-2.5 text-gray-600">{claim.newUsername || '—'}</td>
                <td className="px-4 py-2.5 text-gray-500">{new Date(claim.timestamp).toLocaleDateString()}</td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">No referral claims yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}