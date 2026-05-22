import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getGeneratedPage } from '@/lib/data/places'
import type { NaverPlaceReview, CategoryType } from '@/types'
import BookingForm from './BookingForm'

// ── 업종 감지 ──────────────────────────────────────────────
function detectCategoryType(category: string): CategoryType {
  if (/네일|뷰티|헤어|미용|피부|속눈썹|왁싱|메이크업|마사지|스파|에스테틱|살롱/.test(category)) return 'beauty'
  if (/음식|식당|카페|커피|베이커리|빵|레스토랑|한식|중식|일식|양식|분식|치킨|피자|햄버거|디저트|술집|바/.test(category)) return 'food'
  if (/숙소|펜션|호텔|모텔|게스트하우스|리조트|민박|여관/.test(category)) return 'accommodation'
  if (/피트니스|헬스|요가|필라테스|크로스핏|수영|태권도|격투|복싱|체육관|운동/.test(category)) return 'fitness'
  return 'default'
}

// ── 테마 ───────────────────────────────────────────────────
interface Theme { accent: string; ctaText: string; bookingTitle: string; type: CategoryType }

const THEMES: Record<CategoryType, Omit<Theme, 'type'>> = {
  beauty:        { accent: '#C2185B', ctaText: '시술 예약', bookingTitle: '시술 예약' },
  food:          { accent: '#E65100', ctaText: '테이블 예약', bookingTitle: '테이블 예약' },
  accommodation: { accent: '#1565C0', ctaText: '객실 예약', bookingTitle: '객실 예약' },
  fitness:       { accent: '#2E7D32', ctaText: '예약하기', bookingTitle: '수업 예약' },
  default:       { accent: '#424242', ctaText: '예약하기', bookingTitle: '예약 신청' },
}

// ── 별점 분포 계산 ─────────────────────────────────────────
function calcDistribution(reviews: NaverPlaceReview[]) {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let valid = 0
  reviews.forEach((r) => {
    const s = Math.round(r.rating)
    if (s >= 1 && s <= 5) { counts[s]++; valid++ }
  })
  const total = valid || 1
  return [5, 4, 3, 2, 1].map((star) => ({ star, pct: Math.round((counts[star] / total) * 100) }))
}

// ── 리뷰 요약 ─────────────────────────────────────────────
function RatingSummary({
  reviews, average, accent,
}: { reviews: NaverPlaceReview[]; average: number; accent: string }) {
  const dist = calcDistribution(reviews)
  const hasIndividual = reviews.some((r) => r.rating > 0)

  return (
    <div className="mb-4">
      {/* 한 줄: 숫자 + 별 + "네이버 리뷰 기준" */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span style={{ fontSize: 56, fontWeight: 700, color: '#111111', lineHeight: 1 }}>
          {average}
        </span>
        <span style={{ color: '#F59E0B', fontSize: 22, letterSpacing: 1 }}>
          {'★'.repeat(Math.round(average))}{'☆'.repeat(5 - Math.round(average))}
        </span>
        <span style={{ color: '#333333', fontSize: 16, fontWeight: 600 }}>
          네이버 리뷰 기준
        </span>
      </div>

      {/* 별점 분포 바 */}
      {hasIndividual && (
        <div className="space-y-2 mt-4">
          {dist.map(({ star, pct }) => (
            <div key={star} className="flex items-center gap-1.5">
              <span className="text-[12px] w-3 text-right flex-shrink-0" style={{ color: '#444444' }}>{star}</span>
              <span className="flex-shrink-0" style={{ color: '#F59E0B', fontSize: 10 }}>★</span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
              </div>
              <span className="w-7 text-right flex-shrink-0 text-[11px]" style={{ color: '#444444' }}>{pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 인용구 스타일 리뷰 카드 ──────────────────────────────
function ReviewCard({ review, accent }: { review: NaverPlaceReview; accent: string }) {
  return (
    <div
      className="w-[270px] flex-shrink-0 snap-start bg-white px-4 pt-4 pb-5"
      style={{ borderBottom: '1px solid #EEEEEE' }}
    >
      <div
        className="leading-none mb-3 select-none"
        style={{ color: accent, fontSize: 48, fontFamily: 'Georgia, serif', lineHeight: 1 }}
        aria-hidden
      >
        &ldquo;
      </div>
      <p className="leading-relaxed line-clamp-3 mb-4" style={{ color: '#333333', fontSize: 16 }}>
        {review.content}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[13px] font-bold" style={{ color: '#111111' }}>{review.author}</span>
        {review.date && (
          <span className="text-[12px]" style={{ color: '#444444' }}>{review.date}</span>
        )}
        {review.rating > 0 && (
          <span className="text-[12px]" style={{ color: '#F59E0B' }}>
            {'★'.repeat(Math.round(review.rating))}
          </span>
        )}
      </div>
    </div>
  )
}

// ── 정보 행 ────────────────────────────────────────────────
function InfoRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-5 border-b border-gray-100 last:border-0">
      <span className="flex-shrink-0 w-8 text-center" style={{ fontSize: 26, lineHeight: 1.4 }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="mb-1"
          style={{ fontSize: 16, color: '#111111', fontWeight: 700 }}
        >
          {label}
        </p>
        <div style={{ fontSize: 24, color: '#111111', fontWeight: 500 }}>{children}</div>
      </div>
    </div>
  )
}

// ── 섹션 제목 ──────────────────────────────────────────────
function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[18px] font-bold" style={{ color: '#111111' }}>{children}</h2>
      {right}
    </div>
  )
}

// ── Metadata ───────────────────────────────────────────────
interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getGeneratedPage(params.slug)
  if (!page) return {}
  const { data: p } = page
  return {
    title: p.name,
    description: `${p.address} · ⭐ ${p.averageRating} · 리뷰 ${p.totalReviewCount.toLocaleString()}개`,
  }
}

// ── 메인 페이지 ────────────────────────────────────────────
export default async function PlacePage({ params }: Props) {
  const page = await getGeneratedPage(params.slug)
  if (!page) notFound()

  const { data: place, placeId } = page
  const catType = detectCategoryType(place.category)
  const theme: Theme = { ...THEMES[catType], type: catType }
  const naverPlaceUrl = `https://pcmap.place.naver.com/place/${placeId}/home`

  const socialLinks = [
    { icon: '🗺️', label: '네이버 플레이스', sub: '가게 정보 · 길찾기', url: naverPlaceUrl },
    ...(place.instagramUrl
      ? [{ icon: '📷', label: '인스타그램', sub: '포트폴리오 · 소식', url: place.instagramUrl }]
      : []),
  ]

  const kakaoHref = place.kakaoChannelUrl ?? (place.phone ? `tel:${place.phone}` : '#')
  const kakaoIsExternal = !!place.kakaoChannelUrl

  // 콘텐츠 영역 padding: 모바일 16px, 데스크톱 좌우 각 20%
  const px = 'px-4 lg:px-[20%]'

  return (
    <div className="bg-white min-h-screen font-sans">

      {/* ── 대표 사진 (full-width, no padding) ──── */}
      <div className="w-full overflow-hidden bg-gray-200" style={{ height: 280 }}>
        {place.imageUrls[0] ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={place.imageUrls[0]} alt={place.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(150deg, ${theme.accent}88 0%, ${theme.accent} 100%)` }}
          />
        )}
      </div>

      {/* ── 가게 이름 + 카테고리 + 별점 ────────── */}
      <div className={`${px} pt-5 pb-4 border-b border-gray-100`}>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight" style={{ color: '#111111' }}>
          {place.name}
        </h1>
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <span
            className="text-[12px] font-bold px-3 py-1 rounded-full text-white"
            style={{ backgroundColor: theme.accent }}
          >
            {place.category}
          </span>
          <span style={{ color: '#F59E0B', fontSize: 13, letterSpacing: 1 }}>
            {'★'.repeat(Math.round(place.averageRating))}{'☆'.repeat(5 - Math.round(place.averageRating))}
          </span>
          <span className="text-[14px] font-bold" style={{ color: '#111111' }}>{place.averageRating}</span>
          <span className="text-[13px]" style={{ color: '#444444' }}>
            · 리뷰 {place.totalReviewCount.toLocaleString()}개
          </span>
        </div>
      </div>

      {/* ── 기본 정보 ─────────────────────────── */}
      <div className={`${px} border-b border-gray-100`}>
        {place.address && (
          <InfoRow icon="📍" label="주소">{place.address}</InfoRow>
        )}
        {place.phone && (
          <InfoRow icon="📞" label="전화번호">
            <a href={`tel:${place.phone}`} className="font-bold" style={{ color: theme.accent }}>
              {place.phone}
            </a>
          </InfoRow>
        )}
        {place.hours && (
          <InfoRow icon="🕐" label="영업시간">
            <span style={{ color: '#1B8A5A' }}>{place.hours}</span>
          </InfoRow>
        )}
      </div>

      {/* ── 사진 갤러리 ───────────────────────── */}
      {place.imageUrls.length > 1 && (
        <div className={`${px} py-5 border-b border-gray-100`}>
          <SectionTitle>사진</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {place.imageUrls.slice(1).map((url, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${place.name} 사진 ${i + 2}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 예약 ──────────────────────────────── */}
      <div className={`${px} py-5 border-b border-gray-100`}>
        <SectionTitle>{theme.bookingTitle}</SectionTitle>
        <BookingForm
          placeId={placeId}
          categoryType={catType}
          accentColor={theme.accent}
          ctaText={theme.ctaText}
        />
      </div>

      {/* ── 방문자 리뷰 ───────────────────────── */}
      {place.reviews.length > 0 && (
        <div className={`${px} pt-2 pb-5 border-b border-gray-100`}>
          <SectionTitle
            right={
              <span className="text-[13px] font-medium" style={{ color: '#444444' }}>
                {place.totalReviewCount.toLocaleString()}개
              </span>
            }
          >
            방문자 리뷰
          </SectionTitle>

          <RatingSummary reviews={place.reviews} average={place.averageRating} accent={theme.accent} />

          {/* 가로 스크롤 카드 */}
          <div
            className="w-full flex overflow-x-auto snap-x snap-mandatory gap-4 pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >
            {place.reviews.map((review, i) => (
              <ReviewCard key={i} review={review} accent={theme.accent} />
            ))}
          </div>

          <a
            href={`https://pcmap.place.naver.com/place/${placeId}/review/visitor`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full h-16 mt-5 rounded-2xl border-2 text-[24px] font-bold transition-colors"
            style={{ borderColor: theme.accent, color: theme.accent }}
          >
            리뷰 전체 보기
          </a>
        </div>
      )}

      {/* ── 바로가기 링크 ─────────────────────── */}
      <div className={`${px} py-5 border-b border-gray-100`}>
        <SectionTitle>바로가기</SectionTitle>
        <div className="space-y-2.5">
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full px-4 py-4 rounded-2xl bg-[#F8F8F8] hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <span className="text-[20px] w-7 text-center flex-shrink-0">{link.icon}</span>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 20, color: '#111111', fontWeight: 700 }}>{link.label}</p>
                <p className="mt-0.5" style={{ fontSize: 16, color: '#444444' }}>{link.sub}</p>
              </div>
              <svg
                className="w-4 h-4 flex-shrink-0"
                style={{ color: '#444444' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          ))}
        </div>
      </div>

      {/* ── 푸터 ──────────────────────────────── */}
      <div className={`${px} py-4 pb-36 text-center`}>
        <p style={{ fontSize: 18, color: '#111111', fontWeight: 700 }}>© {place.name}</p>
        <p className="mt-1" style={{ fontSize: 16, color: '#444444' }}>
          Powered by{' '}
          <span className="font-semibold" style={{ color: theme.accent }}>PlaceOne</span>
        </p>
      </div>

      {/* ── 하단 고정 CTA ──────────────────────── */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 py-3 ${px}`}>
        <div className="flex gap-2.5">
          {place.phone && (
            <a
              href={`tel:${place.phone}`}
              className="flex-1 flex items-center justify-center gap-1.5 h-16 rounded-2xl border-2 bg-white text-[24px] font-bold transition-colors"
              style={{ borderColor: theme.accent, color: theme.accent }}
            >
              <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              전화하기
            </a>
          )}
          <a
            href={kakaoHref}
            {...(kakaoIsExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="flex-[2] flex items-center justify-center gap-2 h-16 rounded-2xl text-[24px] font-bold transition-all hover:brightness-95 active:scale-[0.98]"
            style={{ backgroundColor: '#FEE500', color: '#1A1A1A' }}
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.477 3 2 6.477 2 10.9c0 2.7 1.45 5.1 3.7 6.6L4.8 21l4.1-2.2c1 .3 2.1.4 3.1.4 5.523 0 10-3.477 10-7.9S17.523 3 12 3z" />
            </svg>
            카카오톡 상담
          </a>
        </div>
      </div>

    </div>
  )
}
