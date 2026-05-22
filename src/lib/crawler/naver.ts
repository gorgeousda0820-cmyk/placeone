import { chromium, type Page } from 'playwright'
import type { NaverPlaceInfo, NaverPlaceReview } from '@/types'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
]

const CATEGORY_SLUG_MAP: Record<string, string> = {
  restaurant: '음식점',
  cafe: '카페',
  nailshop: '네일샵',
  beautyshop: '뷰티·미용',
  hairshop: '헤어샵',
  hospital: '병원',
  pharmacy: '약국',
  mart: '마트',
  convenience: '편의점',
  fitness: '헬스장',
  accommodation: '숙박',
  attraction: '관광명소',
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function jitter(min = 800, max = 2500) {
  return sleep(Math.floor(Math.random() * (max - min + 1)) + min)
}

export function extractPlaceId(url: string): string | null {
  const patterns = [
    /map\.naver\.com\/(?:v5\/|p\/)?entry\/place\/(\d+)/,
    /pcmap\.place\.naver\.com\/place\/(\d+)/,
    /(?:m\.)?place\.naver\.com\/[^/?]+\/(\d+)/,
  ]
  for (const pattern of patterns) {
    const m = url.match(pattern)
    if (m) return m[1]
  }
  return null
}

function extractCategoryFromUrl(url: string): string {
  const m = url.match(/(?:m\.)?place\.naver\.com\/([^/?]+)\/\d+/)
  if (!m) return ''
  return CATEGORY_SLUG_MAP[m[1]] ?? m[1]
}

async function crawlHome(page: Page, placeId: string) {
  await page.goto(`https://pcmap.place.naver.com/place/${placeId}/home`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await jitter(1500, 3000)
  await page.waitForLoadState('networkidle').catch(() => {})

  return page.evaluate(() => {
    const body = document.body.innerText

    // ── 가게 이름 ──
    let name = document.querySelector('h1')?.textContent?.trim() ?? ''
    if (!name) {
      for (const h of Array.from(document.querySelectorAll('h2'))) {
        const t = h.textContent?.trim() ?? ''
        if (t && t.length < 40) { name = t; break }
      }
    }

    // ── 카테고리 ──
    let category = ''
    const h1 = document.querySelector('h1')
    if (h1) {
      let sib = h1.nextElementSibling
      while (sib) {
        const t = sib.textContent?.trim() ?? ''
        if (t && t.length < 25 && /[가-힣]/.test(t) && !/이전|다음|뒤로/.test(t)) {
          category = t; break
        }
        sib = sib.nextElementSibling
      }
    }

    // ── 전화번호 ── (tel: 링크가 가장 신뢰도 높음)
    const telEl = document.querySelector('a[href^="tel:"]')
    const phone =
      telEl?.getAttribute('href')?.replace('tel:', '').trim() ||
      body.match(/\d{2,4}-\d{3,4}-\d{4}/)?.[0] ||
      ''

    // ── 주소 ──
    // 시/도명으로 시작하는 패턴을 찾고, 번지/호 이후는 제거
    const cities = '서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주'
    const addrRE = new RegExp(`(${cities})[가-힣\\s\\d()·,.-]{5,80}`)
    const allAddrMatches = body.match(new RegExp(addrRE.source, 'g')) ?? []
    let rawAddress =
      allAddrMatches.find((m) => /[구동로길번지]/.test(m)) ||
      allAddrMatches[0] ||
      ''
    // 번지/호 번호 이후 불필요 텍스트 제거 (예: "204호 이후 길찾기 안내 ...")
    rawAddress = rawAddress.replace(/\s+/g, ' ').trim()
    const unitMatch = rawAddress.match(/\d+호/)
    const address = unitMatch
      ? rawAddress.slice(0, rawAddress.indexOf(unitMatch[0]) + unitMatch[0].length)
      : rawAddress.length > 60
        ? rawAddress.slice(0, 60).trim()
        : rawAddress

    // ── 영업시간 ──
    const timePatterns = [
      // "매일|평일|주말 HH:MM ~ HH:MM"
      /(?:매일|평일|주말|월|화|수|목|금|토|일)[^:\n]{0,10}\d{1,2}:\d{2}[^:\n]{0,10}\d{1,2}:\d{2}/,
      // "HH:MM ~ HH:MM"
      /\d{1,2}:\d{2}\s*[~-]\s*\d{1,2}:\d{2}/,
      // "영업 중 · 21:00에 영업 종료"
      /영업\s*중[^\n]{0,30}\d{1,2}:\d{2}[^\n]{0,20}/,
      // "영업시간 ..." 이후 텍스트
      /영업시간\s*[:\n]?\s*([^\n]{3,60})/,
    ]
    let hours = ''
    for (const re of timePatterns) {
      const m = body.match(re)
      if (m) { hours = (m[1] ?? m[0]).replace(/\s+/g, ' ').trim(); break }
    }

    // ── 별점·리뷰 수 ──
    let averageRating = 0
    let totalReviewCount = 0

    const ratingMatch = body.match(/(?:방문자\s*리뷰|별점)[^\d]*([1-5]\.\d{1,2})/)
    if (ratingMatch) averageRating = parseFloat(ratingMatch[1])
    if (!averageRating) {
      for (const el of Array.from(document.querySelectorAll('em, strong'))) {
        const t = el.textContent?.trim() ?? ''
        if (/^[1-5]\.\d{1,2}$/.test(t)) { averageRating = parseFloat(t); break }
      }
    }

    const countMatch = body.match(/방문자\s*리뷰\s*([\d,]+)/)
    if (countMatch) totalReviewCount = parseInt(countMatch[1].replace(/,/g, ''))

    return { name, category, phone, address, hours, averageRating, totalReviewCount }
  })
}

async function crawlPhotos(page: Page, placeId: string): Promise<string[]> {
  await page.goto(`https://pcmap.place.naver.com/place/${placeId}/photo`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await jitter(1200, 2500)
  await page.waitForLoadState('networkidle').catch(() => {})

  return page.evaluate(() => {
    const seen = new Set<string>()
    const results: string[] = []
    for (const img of Array.from(document.querySelectorAll('img'))) {
      const src = img.src || img.dataset.src || img.getAttribute('data-lazy-src') || ''
      if (
        src &&
        !seen.has(src) &&
        src.includes('pstatic.net') &&
        !src.includes('profile') &&
        !src.includes('icon') &&
        src.length > 60
      ) {
        seen.add(src)
        results.push(src)
        if (results.length >= 10) break
      }
    }
    return results
  })
}

async function crawlReviews(
  page: Page,
  placeId: string,
  debug = false,
): Promise<{ reviews: NaverPlaceReview[]; rating: number; count: number }> {
  await page.goto(`https://pcmap.place.naver.com/place/${placeId}/review/visitor`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await jitter(1500, 3000)
  await page.waitForLoadState('networkidle').catch(() => {})

  // 스크롤로 lazy-load 트리거
  for (let i = 1; i <= 3; i++) {
    await page.evaluate((step) => window.scrollTo(0, step * 500), i)
    await sleep(400)
  }
  await jitter(500, 1000)

  const rawText: string = await page.evaluate(() => document.body.innerText)

  if (debug) {
    const reviewerStatsREDebug = /^리뷰\s*\d+사진\s*\d+/
    const statsLines = rawText.split('\n').map(l => l.trim()).filter(l => reviewerStatsREDebug.test(l))
    console.log(`\n[DEBUG] reviewer stats 라인 수: ${statsLines.length}`)
    statsLines.forEach(l => console.log(`  → "${l}"`))
    console.log('\n[DEBUG] 리뷰 페이지 innerText 앞 4000자:')
    console.log(rawText.slice(0, 4000))
    console.log('[DEBUG END]\n')
  }

  // ── 별점 + 리뷰 수 ──
  // "4.81방문자 리뷰 2,334" 형식
  let rating = 0
  let count = 0
  const statsMatch = rawText.match(/([1-5]\.\d{1,2})방문자\s*리뷰\s*([\d,]+)/)
  if (statsMatch) {
    rating = parseFloat(statsMatch[1])
    count = parseInt(statsMatch[2].replace(/,/g, ''))
  }

  // ── 리뷰 블록 구조 파싱 ──
  // 리뷰 페이지 구조:
  //   [닉네임]
  //   리뷰 N사진 N[팔로워 N]  ← 앵커 (reviewer stats)
  //   팔로우
  //   [서비스태그 - Designer]  ← 스킵
  //   [리뷰 본문 여러 줄]
  //   더보기 / 키워드+N 등      ← 본문 종료
  //   방문일 → 날짜 → 방문횟수
  //   인증 수단 → 예약
  //   [사장님 답글 구간]

  const reviewerStatsRE = /^리뷰\s*\d+사진\s*\d+/
  const isServiceTag = (s: string) => /Designer/.test(s)
  const contentStop = new Set([
    '더보기', '방문일', '반응 남기기', '펼쳐보기', '인증 수단',
    '펼쳐보기', '개의 리뷰가 더 있습니다',
  ])
  const isKeywordTag = (s: string) => /\+\d+$/.test(s)
  const visitDateRE = /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일/
  const visitCountRE = /^(\d+)번째\s*방문/

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const reviews: NaverPlaceReview[] = []

  for (let i = 1; i < lines.length && reviews.length < 5; i++) {
    if (!reviewerStatsRE.test(lines[i])) continue

    // 앵커 바로 앞 줄 = 닉네임
    const author = lines[i - 1]

    // 팔로우 + 서비스태그 건너뜀
    let j = i + 1
    while (j < lines.length && (lines[j] === '팔로우' || isServiceTag(lines[j]))) j++

    // 리뷰 본문 수집
    const contentLines: string[] = []
    while (j < lines.length) {
      const l = lines[j]
      if (contentStop.has(l) || isKeywordTag(l) || reviewerStatsRE.test(l) || isServiceTag(l)) break
      if (l) contentLines.push(l)
      j++
    }

    const content = contentLines.join(' ').replace(/\s+/g, ' ').trim()
    if (!content || content.length < 15 || !/[가-힣]{4,}/.test(content)) continue

    // 방문일 섹션에서 날짜·방문횟수 추출
    let date = ''
    let visitCount: number | undefined

    for (let k = j; k < Math.min(j + 20, lines.length); k++) {
      if (reviewerStatsRE.test(lines[k])) break  // 다음 리뷰 시작
      if (lines[k] === '방문일') {
        for (let m = k + 1; m < Math.min(k + 6, lines.length); m++) {
          if (visitDateRE.test(lines[m])) {
            date = lines[m].replace(/\s*[월화수목금토일]요일.*/, '').trim()
            break
          }
        }
        for (let m = k + 1; m < Math.min(k + 6, lines.length); m++) {
          const vm = lines[m].match(visitCountRE)
          if (vm) { visitCount = parseInt(vm[1]); break }
        }
        break
      }
    }

    reviews.push({
      author,
      content: content.slice(0, 500),
      rating: 0,
      date,
      visitCount,
    })
  }

  // innerText로 못 찾은 경우 DOM fallback
  if (reviews.length === 0) {
    const domReviews: NaverPlaceReview[] = await page.evaluate((): NaverPlaceReview[] => {
      const dateRE = /\d{4}\.\d{2}\.\d{2}|\d{1,2}월\s*\d{1,2}일|방금|분 전|시간 전|일 전|달 전/
      const ratingLineRE = /^[1-5]$|^[1-5]\.\d+$/
      const results: NaverPlaceReview[] = []

      const containers = Array.from(
        document.querySelectorAll('ul > li, [class*="ReviewItem"], [class*="review_item"]'),
      )
      for (const card of containers) {
        if (results.length >= 5) break
        const cardText = card.textContent?.trim() ?? ''
        if (cardText.length < 20 || !/[가-힣]{10,}/.test(cardText)) continue

        const leaves = Array.from(card.querySelectorAll('*'))
          .filter((el) => el.children.length === 0)
          .map((el) => el.textContent?.trim() ?? '')
          .filter((t) => t.length > 0)

        const content = leaves
          .filter((t) => /[가-힣]{10,}/.test(t))
          .sort((a, b) => b.length - a.length)[0] ?? ''
        if (!content || content.length < 15) continue

        const author =
          leaves.find(
            (t) =>
              t !== content &&
              t.length > 0 &&
              t.length < 20 &&
              /[가-힣a-z0-9*]/i.test(t) &&
              !/영업|전화|지도|공유|신고|저장/.test(t),
          ) ?? '익명'
        const date = leaves.find((t) => dateRE.test(t)) ?? ''
        const ratingStr = leaves.find((t) => ratingLineRE.test(t)) ?? ''

        results.push({ author, content, rating: ratingStr ? parseFloat(ratingStr) : 0, date })
      }
      return results
    })
    reviews.push(...domReviews)
  }

  return { reviews, rating, count }
}

export async function crawlNaverPlace(
  inputUrl: string,
  options: { debug?: boolean } = {},
): Promise<NaverPlaceInfo> {
  let placeId = extractPlaceId(inputUrl)
  const categoryFromUrl = extractCategoryFromUrl(inputUrl)
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  })

  try {
    const context = await browser.newContext({
      userAgent: ua,
      viewport: { width: 1280, height: 900 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      extraHTTPHeaders: {
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        Referer: 'https://map.naver.com/',
      },
    })

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
      Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'] })
      ;(window as unknown as Record<string, unknown>).chrome = { runtime: {} }
    })

    const page = await context.newPage()

    if (!placeId) {
      await page.goto(inputUrl, { waitUntil: 'networkidle', timeout: 30000 })
      placeId = extractPlaceId(page.url())
      if (!placeId) throw new Error(`유효한 네이버 플레이스 URL이 아닙니다: ${inputUrl}`)
    }

    console.log(`\n[크롤러] 플레이스 ID: ${placeId}`)

    console.log('[1/3] 기본 정보 수집 중...')
    const homeInfo = await crawlHome(page, placeId)
    await jitter(600, 1200)

    console.log('[2/3] 사진 수집 중...')
    const imageUrls = await crawlPhotos(page, placeId)
    await jitter(600, 1200)

    console.log('[3/3] 리뷰 수집 중...')
    const { reviews, rating, count } = await crawlReviews(page, placeId, options.debug)

    return {
      name: homeInfo.name,
      category: categoryFromUrl || homeInfo.category || '',
      address: homeInfo.address,
      phone: homeInfo.phone || undefined,
      hours: homeInfo.hours || undefined,
      imageUrls,
      reviews,
      totalReviewCount: count || homeInfo.totalReviewCount,
      averageRating: rating || homeInfo.averageRating,
    }
  } finally {
    await browser.close()
  }
}
