export interface Movie {
  id: string
  title: string
  category: string
  genres: string[]
  year: number
  description: string
  imdbRating?: number
  badge?: string
  trailerKey?: string
  trailerUrl?: string
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

export interface Category {
  id: string
  name: string
  order: number
}

export interface Genre {
  id: string
  name: string
}

export interface RedemptionCode {
  id: string
  username: string
  status: 'unused' | 'used'
  usedAt?: string
  movieId?: string
  createdAt: string
}

export interface AppUser {
  id: string
  username: string
  realName: string
  phoneNumber: string
  jazzCashNumber: string
  jazzCashTitle: string
  referralCount: number
  referredBy?: string
  createdAt?: string
}

export interface Banner {
  id: string
  imageKey: string
  imageUrl: string
  clickable: boolean
  linkedMovieId?: string
  order: number
}

export interface PricingSettings {
  standardPrice: number
  referralPrice: number
  referralPayout: number
}

export const SECTIONS = [
  { value: 'recently-added', label: 'Recently Added' },
  { value: 'hot', label: 'Hot' },
  { value: 'all-time-hit', label: 'All-time Hit' },
  { value: 'hit-of-this-year', label: 'Hit of This Year' },
] as const

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/x-matroska', 'video/webm']
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024 // 10GB