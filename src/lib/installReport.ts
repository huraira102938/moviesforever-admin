/**
 * Turns the installDaily rows into the numbers on the Installs page.
 *
 * The Cloudflare Worker saves the running total at the start of every Pakistan-time hour
 * (h00..h23) and closes each day at midnight, so a day with h00 is exact. Days from before
 * that started were only recorded when the panel was opened, so they are approximate.
 */

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000 // Pakistan has no daylight saving
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export interface InstallSnapshot {
  date: string
  endTotal: number
  [hour: `h${string}`]: number | undefined
}

export interface InstallDay {
  date: string
  installs: number
  runningTotal: number
  exact: boolean
}

export interface InstallReport {
  days: InstallDay[]
  today: InstallDay | null
  yesterday: InstallDay | null
  /** null until the Worker has a snapshot from about 24 hours ago */
  last24Hours: number | null
}

function pktParts(ms: number) {
  const iso = new Date(ms + PKT_OFFSET_MS).toISOString()
  return { date: iso.slice(0, 10), hour: iso.slice(11, 13) }
}

export function buildInstallReport(snapshots: InstallSnapshot[], liveTotal: number, nowMs: number): InstallReport {
  // Today always uses the live total, even if today's row has not been saved yet.
  const today = pktParts(nowMs).date
  const todayRow: InstallSnapshot = { ...snapshots.find(s => s.date === today), date: today, endTotal: liveTotal }
  const sorted = [...snapshots.filter(s => s.date !== today), todayRow].sort((a, b) => a.date.localeCompare(b.date))

  const days = sorted.map((s, i) => {
    const start = s.h00 ?? (i === 0 ? 0 : sorted[i - 1].endTotal)
    return {
      date: s.date,
      installs: Math.max(0, s.endTotal - start),
      runningTotal: s.endTotal,
      exact: s.h00 !== undefined,
    }
  })

  // Nearest saved hour to exactly 24 hours ago, looking a little further back if a run was missed.
  const byDate = new Map(sorted.map(s => [s.date, s]))
  const target = Math.round((nowMs - DAY_MS) / HOUR_MS) * HOUR_MS
  let last24Hours: number | null = null
  for (let back = 0; back <= 3 && last24Hours === null; back++) {
    const { date, hour } = pktParts(target - back * HOUR_MS)
    const saved = byDate.get(date)?.[`h${hour}`]
    if (saved !== undefined) last24Hours = Math.max(0, liveTotal - saved)
  }

  const find = (date: string) => days.find(d => d.date === date) ?? null
  return {
    days,
    today: find(today),
    yesterday: find(pktParts(nowMs - DAY_MS).date),
    last24Hours,
  }
}
