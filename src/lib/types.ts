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
  paymentMethod?: string
  paymentNumber?: string
  accountTitle?: string
  referralCount: number
  referredBy?: string
  paused?: boolean
  pauseUserNote?: string
  pauseAdminNote?: string
  pausedAt?: string
  subscribedAt?: string
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

export interface PaymentTransaction {
  id: string
  clientUserId: string
  clientUsername: string
  clientRealName: string
  clientPhoneNumber: string
  clientJazzCashNumber: string
  clientJazzCashTitle: string
  paymentMethod?: string
  paymentNumber?: string
  accountTitle?: string
  totalReceived: number
  referralUsername?: string
  referrerPendingAmount: number
  status: 'pending' | 'paid'
  createdAt: string
  paidAt?: string
}

export type NotificationTarget = 'free' | 'paid' | 'paused'

export interface AppNotification {
  id: string
  text: string
  targets: NotificationTarget[]
  createdAt: string
}

export const REFERRAL_PAYOUT_OPTIONS = [50, 100, 150, 200] as const

export const SECTIONS = [
  { value: 'recently-added', label: 'Recently Added' },
  { value: 'hot', label: 'Hot' },
  { value: 'all-time-hit', label: 'All-time Hit' },
  { value: 'hit-of-this-year', label: 'Hit of This Year' },
] as const

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/x-matroska', 'video/webm']
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024 // 10GB