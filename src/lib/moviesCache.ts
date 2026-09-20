import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import type { Movie } from './types'

/**
 * In-memory cache for the `movies` collection (admin panel only).
 *
 * Why: MovieList, Trending, BannerManager (and the movie pickers inside them)
 * each used to download the ENTIRE movies collection every time the page was
 * opened - one Firestore read per movie, per page visit. This loads it once
 * and shares it between pages.
 *
 * Safety rules:
 *  - Memory only. Pressing F5 / reloading the tab always starts fresh.
 *  - Auto-expires after MAX_AGE_MS, so a long-open tab (or edits made from
 *    another device) can never stay stale for more than that.
 *  - Every place in the admin that writes to `movies` also updates this cache
 *    (see updateCachedMovie / addCachedMovie / removeCachedMovie), so what you
 *    see always matches what you just saved.
 *  - Errors are never cached: a failed load simply retries on the next visit.
 */

const MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes

let cache: Movie[] | null = null
let loadedAt = 0
let inflight: Promise<Movie[]> | null = null
// Bumped by every local mutation. If a mutation happens while a fetch is still
// running, that fetch result is not trusted for caching (it might not include
// the change), so the next call fetches again.
let version = 0

export async function getMovies(): Promise<Movie[]> {
  if (cache && Date.now() - loadedAt < MAX_AGE_MS) {
    return [...cache]
  }
  if (inflight) {
    // Another page/effect is already loading - share that request
    // (this also de-duplicates React StrictMode's double effect run in dev).
    return inflight.then(list => [...list])
  }

  const startedAtVersion = version
  const request = getDocs(collection(db, 'movies'))
    .then(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Movie))
      if (version === startedAtVersion) {
        cache = list
        loadedAt = Date.now()
      } else {
        cache = null
      }
      return list
    })
    .finally(() => {
      inflight = null
    })

  inflight = request
  return request.then(list => [...list])
}

/** Drop the cache so the next getMovies() re-reads from Firestore. */
export function invalidateMovies() {
  version++
  cache = null
}

/** Call after a movie is created. No-op if nothing is cached yet. */
export function addCachedMovie(id: string, data: Record<string, unknown>) {
  version++
  if (!cache) return
  cache = [...cache.filter(m => m.id !== id), { id, ...data } as unknown as Movie]
}

/** Call after a movie is edited/paused/resumed. No-op if nothing is cached yet. */
export function updateCachedMovie(id: string, patch: Record<string, unknown>) {
  version++
  if (!cache) return
  cache = cache.map(m => (m.id === id ? ({ ...m, ...patch } as Movie) : m))
}

/** Call after a movie is deleted. No-op if nothing is cached yet. */
export function removeCachedMovie(id: string) {
  version++
  if (!cache) return
  cache = cache.filter(m => m.id !== id)
}
