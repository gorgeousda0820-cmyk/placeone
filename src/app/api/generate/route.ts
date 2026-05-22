import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { crawlNaverPlace, extractPlaceId } from '@/lib/crawler/naver'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  let url: string
  try {
    const body = await req.json()
    url = body?.url
  } catch {
    return NextResponse.json({ error: 'URL을 입력해주세요.' }, { status: 400 })
  }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL을 입력해주세요.' }, { status: 400 })
  }

  const placeId = extractPlaceId(url)
  if (!placeId) {
    return NextResponse.json(
      { error: '올바른 네이버 플레이스 URL을 입력해주세요.\n예) https://m.place.naver.com/nailshop/12345678/home' },
      { status: 400 }
    )
  }

  try {
    const data = await crawlNaverPlace(url)

    const dir = path.join(process.cwd(), 'src', 'data', 'places')
    await fs.mkdir(dir, { recursive: true })

    const payload = {
      placeId,
      slug: placeId,
      data,
      createdAt: new Date().toISOString(),
    }

    await fs.writeFile(
      path.join(dir, `${placeId}.json`),
      JSON.stringify(payload, null, 2),
      'utf-8'
    )

    return NextResponse.json({ pageUrl: `/${placeId}`, placeName: data.name })
  } catch (err) {
    console.error('[generate API]', err)
    return NextResponse.json(
      { error: '크롤링 중 오류가 발생했습니다.\nURL을 확인하고 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
