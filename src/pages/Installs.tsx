import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import {
  getInstallDays,
  getInstallTotal,
  recordInstallSnapshot,
  todayKey,
  type InstallDay,
} from '../lib/installStats'

export default function Installs() {
  const [days, setDays] = useState<InstallDay[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const t = await getInstallTotal()
        setTotal(t)
        await recordInstallSnapshot(t) // keep today's row up to date
        setDays(await getInstallDays())
      } catch (err) {
        console.error(err)
        toast.error('Failed to load installs')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Loading...</p></div>
  }

  const today = todayKey()
  const todayInstalls = days.find(d => d.date === today)?.installs ?? 0
  const last7 = days.slice(-7).reduce((sum, d) => sum + d.installs, 0)
  const rows = [...days].reverse() // newest first

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Installs</h1>
        <p className="text-sm text-gray-500 mt-1">Date-wise breakdown of app installs</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total installs</p>
          <p className="text-3xl font-bold text-gray-900 mt-1 flex items-center gap-2">
            {total} <Download className="w-5 h-5 text-cyan-600" />
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Today ({today})</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{todayInstalls}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Last 7 recorded days</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{last7}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Installs that day</th>
              <th className="px-4 py-3 font-medium">Total so far</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.date} className="border-b last:border-0">
                <td className="px-4 py-3 text-gray-900">{r.date}{r.date === today && <span className="ml-2 text-xs text-indigo-600">today</span>}</td>
                <td className="px-4 py-3 font-semibold text-gray-900">{r.installs}</td>
                <td className="px-4 py-3 text-gray-600">{r.runningTotal}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">No data yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        The first recorded day shows every install counted so far. After that, each day shows only the new installs
        since the previous day. A day is recorded whenever the Dashboard or this page is opened, so if nobody opens
        the panel for a few days, those installs are counted on the next day it is opened.
      </p>
    </div>
  )
}
