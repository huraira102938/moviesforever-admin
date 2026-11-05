import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { getInstallReport, getInstallTotal, recordInstallSnapshot, todayKey } from '../lib/installStats'
import type { InstallDay, InstallReport } from '../lib/installReport'

/** Days from before hourly tracking started get a ~ so they are not mistaken for exact numbers. */
function formatDay(day: InstallDay | null) {
  if (!day) return '—'
  return day.exact ? String(day.installs) : `~${day.installs}`
}

export default function Installs() {
  const [report, setReport] = useState<InstallReport | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const t = await getInstallTotal()
        setTotal(t)
        recordInstallSnapshot(t).catch(console.error) // keep today's row up to date
        setReport(await getInstallReport(t))
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
  const rows = [...(report?.days ?? [])].reverse() // newest first

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Installs</h1>
        <p className="text-sm text-gray-500 mt-1">Date-wise breakdown of app installs</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total installs</p>
          <p className="text-3xl font-bold text-gray-900 mt-1 flex items-center gap-2">
            {total} <Download className="w-5 h-5 text-cyan-600" />
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Today ({today})</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{formatDay(report?.today ?? null)}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Yesterday</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{formatDay(report?.yesterday ?? null)}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Last 24 hours</p>
          {report?.last24Hours == null
            ? <p className="text-sm text-gray-400 mt-3">Collecting data…</p>
            : <p className="text-3xl font-bold text-gray-900 mt-1">{report.last24Hours}</p>}
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
                <td className="px-4 py-3 font-semibold text-gray-900">{formatDay(r)}</td>
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
        Days run from midnight to midnight, Pakistan time. An install is counted when someone taps Start Browsing for
        the first time on a device. Numbers with ~ are from before hourly tracking started, so they are approximate.
      </p>
    </div>
  )
}
