/**
 * 네이버 플레이스 크롤러 테스트 스크립트
 * 실행: npm run test:crawler
 *       npm run test:crawler:json   (JSON 전체 출력)
 *       npx tsx scripts/test-crawler.ts --debug  (리뷰 페이지 innerText 덤프)
 */

import { crawlNaverPlace, extractPlaceId } from '../src/lib/crawler/naver'

const TEST_URL =
  'https://m.place.naver.com/nailshop/835125349/home?entry=ple&from=PLACE_AD&n_ad_group_type=10&n_query=%EB%84%A4%EC%9D%BC%EC%83%B5'

const isDebug = process.argv.includes('--debug')
const isJson = process.argv.includes('--json')
const isSave = process.argv.includes('--save')

async function main() {
  const SEP = '='.repeat(60)
  const LINE = '─'.repeat(40)

  console.log(SEP)
  console.log('네이버 플레이스 크롤러 테스트')
  console.log(SEP)
  console.log(`입력 URL: ${TEST_URL}`)

  const placeId = extractPlaceId(TEST_URL)
  if (placeId) {
    console.log(`추출된 플레이스 ID: ${placeId}`)
    console.log(`직접 접근 URL: https://pcmap.place.naver.com/place/${placeId}/home`)
  }
  console.log(SEP)

  const startTime = Date.now()

  try {
    const result = await crawlNaverPlace(TEST_URL, { debug: isDebug })
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('\n✅ 크롤링 완료\n')
    console.log(LINE)
    console.log(`가게 이름  : ${result.name}`)
    console.log(`카테고리   : ${result.category}`)
    console.log(`주소       : ${result.address}`)
    console.log(`전화번호   : ${result.phone ?? '없음'}`)
    console.log(`영업시간   : ${result.hours ?? '없음'}`)
    console.log(`평균 별점  : ${result.averageRating}`)
    console.log(`총 리뷰 수 : ${result.totalReviewCount}`)
    console.log(`사진 수    : ${result.imageUrls.length}장`)
    console.log(LINE)

    if (result.imageUrls.length > 0) {
      console.log('\n[사진 URL 목록]')
      result.imageUrls.forEach((url, i) => {
        console.log(`  ${i + 1}. ${url.slice(0, 80)}${url.length > 80 ? '...' : ''}`)
      })
    }

    if (result.reviews.length > 0) {
      console.log('\n[대표 리뷰]')
      result.reviews.forEach((review, i) => {
        console.log(`\n  [${i + 1}] ${review.author} | ⭐ ${review.rating || '?'} | ${review.date}`)
        if (review.visitCount) console.log(`      방문 ${review.visitCount}회`)
        console.log(
          `      "${review.content.slice(0, 100)}${review.content.length > 100 ? '...' : ''}"`,
        )
      })
    } else {
      console.log('\n리뷰를 찾을 수 없습니다.')
    }

    console.log(`\n${LINE}`)
    console.log(`소요 시간: ${elapsed}초`)

    if (isJson) {
      console.log('\n[JSON 전체 결과]')
      console.log(JSON.stringify(result, null, 2))
    }

    if (isSave && placeId) {
      const fs = await import('fs/promises')
      await fs.mkdir('./src/data/places', { recursive: true })
      const payload = { placeId, slug: placeId, data: result, createdAt: new Date().toISOString() }
      await fs.writeFile(
        `./src/data/places/${placeId}.json`,
        JSON.stringify(payload, null, 2),
        'utf-8',
      )
      console.log(`\n💾 저장됨: src/data/places/${placeId}.json`)
      console.log(`🔗 미리보기: http://localhost:3000/${placeId}`)
    }
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.error(`\n❌ 크롤링 실패 (${elapsed}초)`)
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

main()
