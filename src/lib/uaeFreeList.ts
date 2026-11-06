import { addDoc, collection, deleteDoc, getDocs } from 'firebase/firestore'
import { db } from './firebase'

/**
 * The UAE's free movies live in their own list. A movie's `isFree` field is Pakistan's setting,
 * so UAE mode must never write it.
 */
const FREE_LIST = 'free-uae'

export async function getUaeFreeIds(): Promise<Set<string>> {
  const snap = await getDocs(collection(db, FREE_LIST))
  return new Set(snap.docs.map(d => String(d.data().movieId)))
}

export async function setUaeFree(movieId: string, free: boolean): Promise<void> {
  const snap = await getDocs(collection(db, FREE_LIST))
  const entries = snap.docs.filter(d => d.data().movieId === movieId)
  if (free && entries.length === 0) {
    const nextOrder = Math.max(-1, ...snap.docs.map(d => Number(d.data().order) || 0)) + 1
    await addDoc(collection(db, FREE_LIST), { movieId, order: nextOrder })
  }
  if (!free) await Promise.all(entries.map(d => deleteDoc(d.ref)))
}
