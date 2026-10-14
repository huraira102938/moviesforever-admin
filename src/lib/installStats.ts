import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Date-wise install tracking.
 *
 * The app only stores ONE running total (installs/counter -> installCount).
 * To get a per-date breakdown we save a snapshot of that total once per day
 * in the `installDaily` collection (doc id = YYYY-MM-DD, field endTotal).
 *
 *   installs on a day = endTotal(that day) - endTotal(previous day)
 *   first recorded day = everything counted so far (e.g. "today is 12 -> all installs are at 12")
 */

const TIMEZONE = 'Asia/Karachi'
const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const todayKey = () => dayFmt.format(new Date())

export interface InstallDay {
  date: string
  installs: number
  runningTotal: number
}

export async function getInstallTotal(): Promise<number> {
  const snap = await getDoc(doc(db, 'installs', 'counter'))
  return snap.exists() ? Number(snap.data().installCount) || 0 : 0
}

/** Saves today's snapshot (creates it or updates it with the latest total). */
export async function recordInstallSnapshot(total: number): Promise<void> {
  const date = todayKey()
  await setDoc(
    doc(db, 'installDaily', date),
    { date, endTotal: total, updatedAt: new Date().toISOString() },
    { merge: true },
  )
}

/** Reads all snapshots and returns the date-wise breakdown (oldest first). */
export async function getInstallDays(): Promise<InstallDay[]> {
  const snap = await getDocs(collection(db, 'installDaily'))
  const snaps = snap.docs
    .map(d => ({ date: d.id, endTotal: Number(d.data().endTotal) || 0 }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return snaps.map((s, i) => ({
    date: s.date,
    installs: i === 0 ? s.endTotal : Math.max(0, s.endTotal - snaps[i - 1].endTotal),
    runningTotal: s.endTotal,
  }))
}
