import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import { getMovies, invalidateMovies } from './moviesCache'
import type { Banner, Category, Movie, TrendingItem } from './types'

/**
 * movies.json -- the single catalogue file the Android app reads (it never reads movies from Firestore).
 *
 * Built here from Firestore (`movies`, `categories`, `trending`) and uploaded to R2 by the
 * "Update JSON" button. The movie objects use the same field names as the Firestore `movies`
 * documents, so the app parses them straight into its Movie model.
 *
 * The key MUST match `CatalogueConfig.FILE_NAME` in the Android app (data/remote/CatalogueConfig.kt).
 */
export const CATALOGUE_KEY = 'movies.json'

/** Copy of the previous live file, kept so a bad update can be rolled back by hand. */
export const CATALOGUE_BACKUP_KEY = 'movies.prev.json'

export const CATALOGUE_VERSION = 1

/** The app shows at most this many banners; the rest are left out of the file. */
export const MAX_BANNERS = 5

export interface CatalogueBanner {
  id: string
  imageUrl: string
  imageKey: string
  clickable: boolean
  linkedMovieId: string | null
  actionType: string
  actionValue: string
  order: number
}

export interface CatalogueMovie {
  id: string
  title: string
  category: string // Firestore category id
  genres: string[] // Firestore genre ids
  year: number | null
  description: string
  imdbRating: number | null
  badge: string | null
  trailerKey: string | null
  trailerUrl: string | null
  videoKey: string
  videoUrl: string
  thumbnailKey: string
  thumbnailUrl: string
  isFree: boolean
  language: string
  availableDubs: string[]
  sections: string[]
  paused: boolean
  createdAt: string
  updatedAt: string
}

export interface CatalogueCategory {
  id: string
  name: string
  order: number
}

export interface CatalogueFile {
  version: number
  generatedAt: string
  categories: CatalogueCategory[]
  trending: string[] // movie ids in display order
  banners: CatalogueBanner[]
  movies: CatalogueMovie[]
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/**
 * One fixed shape with a fixed key order, with no nulls where the app expects a value. Used for
 * both Firestore documents and the live file, so the two can be compared as plain strings.
 */
export function normalizeMovie(raw: any): CatalogueMovie {
  return {
    id: str(raw?.id),
    title: str(raw?.title),
    category: str(raw?.category),
    genres: strList(raw?.genres),
    year: numOrNull(raw?.year),
    description: str(raw?.description),
    imdbRating: numOrNull(raw?.imdbRating),
    badge: strOrNull(raw?.badge),
    trailerKey: strOrNull(raw?.trailerKey),
    trailerUrl: strOrNull(raw?.trailerUrl),
    videoKey: str(raw?.videoKey),
    videoUrl: str(raw?.videoUrl),
    thumbnailKey: str(raw?.thumbnailKey),
    thumbnailUrl: str(raw?.thumbnailUrl),
    isFree: raw?.isFree === true,
    language: str(raw?.language),
    availableDubs: strList(raw?.availableDubs),
    sections: strList(raw?.sections),
    paused: raw?.paused === true,
    createdAt: str(raw?.createdAt),
    updatedAt: str(raw?.updatedAt),
  }
}

export function normalizeBanner(raw: any): CatalogueBanner {
  return {
    id: str(raw?.id),
    imageUrl: str(raw?.imageUrl),
    imageKey: str(raw?.imageKey),
    clickable: raw?.clickable === true,
    linkedMovieId: strOrNull(raw?.linkedMovieId),
    actionType: str(raw?.actionType),
    actionValue: str(raw?.actionValue),
    order: typeof raw?.order === 'number' ? raw.order : 0,
  }
}

const sig = (m: CatalogueMovie) => JSON.stringify(m)

export interface Sources {
  movies: Movie[]
  categories: Category[]
  trending: TrendingItem[]
  banners: Banner[]
}

/**
 * Reads everything needed from Firestore. Movies are always re-read here (the in-memory cache of the
 * other admin pages is dropped first) so a deleted or just-edited movie can never be missed.
 * This is a handful of reads once per update, not per app user.
 */
export async function loadSources(): Promise<Sources> {
  invalidateMovies()
  const [movies, catSnap, trendSnap, bannerSnap] = await Promise.all([
    getMovies(),
    getDocs(collection(db, 'categories')),
    getDocs(collection(db, 'trending')),
    getDocs(collection(db, 'banners')),
  ])
  return {
    movies,
    categories: catSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category)),
    trending: trendSnap.docs.map(d => ({ id: d.id, ...d.data() } as TrendingItem)),
    banners: bannerSnap.docs.map(d => ({ id: d.id, ...d.data() } as Banner)),
  }
}

export interface BuildResult {
  file: CatalogueFile
  /** Movies left out because they have no title or no video file yet (e.g. an unfinished upload). */
  skippedIncomplete: string[]
  /** Paused movies are not published, so they disappear from the app. */
  pausedCount: number
  /** Movies whose category no longer exists: shown in Search, but on no Home shelf. */
  noCategory: string[]
}

export function buildCatalogue(src: Sources, generatedAt = new Date().toISOString()): BuildResult {
  const categories: CatalogueCategory[] = src.categories
    .map(c => ({ id: c.id, name: str(c.name), order: typeof c.order === 'number' ? c.order : 0 }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const categoryIds = new Set(categories.map(c => c.id))

  const skippedIncomplete: string[] = []
  const noCategory: string[] = []
  let pausedCount = 0
  const movies: CatalogueMovie[] = []

  for (const raw of src.movies) {
    const m = normalizeMovie(raw)
    if (m.paused) { pausedCount++; continue }
    if (!m.id || !m.title.trim() || !m.videoUrl) { skippedIncomplete.push(m.title || m.id || '(untitled)'); continue }
    if (!categoryIds.has(m.category)) noCategory.push(m.title)
    movies.push(m)
  }

  // Newest first; id as tie-breaker so the order (and the file) is identical on every run.
  movies.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))

  const published = new Set(movies.map(m => m.id))
  const trending = [...src.trending]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(t => t.movieId)
    .filter((id, i, all) => published.has(id) && all.indexOf(id) === i)

  // Home banners: in the admin's order, only those with an image, at most MAX_BANNERS.
  const banners = src.banners
    .map(normalizeBanner)
    .filter(b => b.imageUrl)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .slice(0, MAX_BANNERS)

  return {
    file: { version: CATALOGUE_VERSION, generatedAt, categories, trending, banners, movies },
    skippedIncomplete,
    pausedCount,
    noCategory,
  }
}

/** Reads a live file back into the same shape; null if it is not a usable catalogue. */
export function parseCatalogue(text: string | null): CatalogueFile | null {
  if (!text) return null
  try {
    const data = JSON.parse(text.replace(/^﻿/, ''))
    if (!data || typeof data !== 'object' || !Array.isArray(data.movies)) return null
    return {
      version: typeof data.version === 'number' ? data.version : CATALOGUE_VERSION,
      generatedAt: str(data.generatedAt),
      categories: Array.isArray(data.categories)
        ? data.categories.map((c: any) => ({ id: str(c?.id), name: str(c?.name), order: typeof c?.order === 'number' ? c.order : 0 }))
        : [],
      trending: strList(data.trending),
      banners: Array.isArray(data.banners) ? data.banners.map(normalizeBanner) : [],
      movies: data.movies.map(normalizeMovie).filter((m: CatalogueMovie) => m.id),
    }
  } catch {
    return null
  }
}

export interface CatalogueDiff {
  added: CatalogueMovie[]
  updated: CatalogueMovie[]
  removed: CatalogueMovie[] // taken from the live file
  categoriesChanged: boolean
  trendingChanged: boolean
  bannersChanged: boolean
  hasChanges: boolean
}

/** What the new file would change compared with the live one. `live` null = nothing uploaded yet. */
export function diffCatalogue(live: CatalogueFile | null, next: CatalogueFile): CatalogueDiff {
  const liveById = new Map((live?.movies ?? []).map(m => [m.id, m]))
  const nextIds = new Set(next.movies.map(m => m.id))

  const added: CatalogueMovie[] = []
  const updated: CatalogueMovie[] = []
  for (const m of next.movies) {
    const old = liveById.get(m.id)
    if (!old) added.push(m)
    else if (sig(old) !== sig(m)) updated.push(m)
  }
  const removed = (live?.movies ?? []).filter(m => !nextIds.has(m.id))

  const categoriesChanged = JSON.stringify(live?.categories ?? []) !== JSON.stringify(next.categories)
  const trendingChanged = JSON.stringify(live?.trending ?? []) !== JSON.stringify(next.trending)

  const bannersChanged = JSON.stringify(live?.banners ?? []) !== JSON.stringify(next.banners)

  return {
    added,
    updated,
    removed,
    categoriesChanged,
    trendingChanged,
    bannersChanged,
    hasChanges: added.length > 0 || updated.length > 0 || removed.length > 0 || categoriesChanged || trendingChanged || bannersChanged,
  }
}

/** Compact JSON (no spaces): the smallest download for every phone. */
export function serializeCatalogue(file: CatalogueFile): string {
  return JSON.stringify(file)
}
