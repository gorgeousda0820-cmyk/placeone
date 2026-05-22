export type CategoryType = 'beauty' | 'food' | 'accommodation' | 'fitness' | 'default'

export interface NaverPlaceReview {
  author: string
  rating: number
  content: string
  date: string
  visitCount?: number
}

export interface NaverPlaceInfo {
  name: string
  category: string
  address: string
  phone?: string
  hours?: string
  description?: string
  imageUrls: string[]
  reviews: NaverPlaceReview[]
  totalReviewCount: number
  averageRating: number
  instagramUrl?: string
  kakaoChannelUrl?: string
}

export interface GeneratedPage {
  id: string
  placeId: string
  placeInfo: NaverPlaceInfo
  createdAt: string
  slug: string
}
