/**
 * The panel runs both apps. The switch in the sidebar picks which market every page reads and
 * writes. Pakistan keeps the original document names, so the live app is never affected.
 * Older documents have no `market` field: they all belong to Pakistan.
 */
export type Market = 'pk' | 'uae'

const STORAGE_KEY = 'mf-admin-market'

function readMarket(): Market {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'uae' ? 'uae' : 'pk'
  } catch {
    return 'pk'
  }
}

export const market: Market = readMarket()
export const isUae = market === 'uae'
export const currency = isUae ? 'AED' : 'PKR'

export function switchMarket(next: Market) {
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch (err) {
    console.error(err)
  }
  window.location.reload()
}

/** settings/pricing -> settings/pricing-uae, and the same for other per-market documents. */
export const marketDocId = (base: string) => (isUae ? `${base}-uae` : base)

export const inMarket = (item: { market?: string | null }) =>
  (item.market === 'uae' ? 'uae' : 'pk') === market

/** Spread into a document when saving, so it can be told apart later. */
export const marketField = isUae ? { market: 'uae' as const } : {}

/** Each market has its own Home banners. */
export const bannersCollection = isUae ? 'banners-uae' : 'banners'
