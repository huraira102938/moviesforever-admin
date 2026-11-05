import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { buildInstallReport, type InstallReport, type InstallSnapshot } from './installReport'

/**
 * Date-wise install tracking.
 *
 * The app only stores ONE running total (installs/counter -> installCount).
 * The Cloudflare Worker saves that total every hour in the `installDaily` collection
 * (doc id = YYYY-MM-DD); see installReport.ts for how the numbers are worked out.
 * Opening the panel only refreshes today's latest total.
 */

const TIMEZONE = 'Asia/Karachi'
const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const todayKey = () => dayFmt.format(new Date())

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

export async function getInstallReport(liveTotal: number): Promise<InstallReport> {
  const snap = await getDocs(collection(db, 'installDaily'))
  const snapshots = snap.docs.map(d => ({
    ...d.data(),
    date: d.id,
    endTotal: Number(d.data().endTotal) || 0,
  }) as InstallSnapshot)
  return buildInstallReport(snapshots, liveTotal, Date.now())
}
