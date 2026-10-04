/**
 * The fixed set of movie-data JSON files the Android app downloads.
 * `key` is the exact object name in R2 and MUST match `TmdbCategory.fileName`
 * in the app (data/model/TmdbMovie.kt). Add/remove a line here to add/remove a slot.
 */
export interface JsonSlot {
  key: string
  label: string
}

export const JSON_SLOTS: JsonSlot[] = [
  { key: 'bollywood.json', label: 'Bollywood' },
  { key: 'hollywood.json', label: 'Hollywood' },
  { key: 'south.json', label: 'South & Tamil' },
  { key: 'punjabi.json', label: 'Punjabi' },
  { key: 'korean-chinese-others.json', label: 'Korean / Chinese / Others' },
  { key: 'animation.json', label: 'Animation' },
  { key: 'anime.json', label: 'Anime' },
  { key: 'trending.json', label: 'Trending' },
]

/** Same minimum the app's Home screen uses (movies rated strictly above this are shown). */
export const HOME_MIN_RATING = 7
