import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

interface Reservation {
  id: string
  placeId: string
  name: string
  phone: string
  date?: string
  time?: string
  checkin?: string
  checkout?: string
  guests?: string
  memo?: string
  status: 'pending'
  createdAt: string
}

const dir = () => path.join(process.cwd(), 'src', 'data', 'reservations')
const filePath = (placeId: string) => path.join(dir(), `${placeId}.json`)

async function readAll(placeId: string): Promise<Reservation[]> {
  try {
    const raw = await fs.readFile(filePath(placeId), 'utf-8')
    return JSON.parse(raw) as Reservation[]
  } catch {
    return []
  }
}

async function saveAll(placeId: string, list: Reservation[]) {
  await fs.mkdir(dir(), { recursive: true })
  await fs.writeFile(filePath(placeId), JSON.stringify(list, null, 2), 'utf-8')
}

export async function POST(req: NextRequest) {
  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { placeId, name, phone, date, time, checkin, checkout, guests, memo } = body

  if (!placeId || !name || !phone) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
  }

  const existing = await readAll(placeId)

  // 날짜+시간 중복 체크
  if (date && time) {
    const dup = existing.some((r) => r.date === date && r.time === time)
    if (dup) {
      return NextResponse.json(
        { error: '해당 시간은 이미 예약이 있습니다. 다른 시간을 선택해주세요.' },
        { status: 409 }
      )
    }
  }

  const reservation: Reservation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    placeId,
    name,
    phone,
    ...(date && { date }),
    ...(time && { time }),
    ...(checkin && { checkin }),
    ...(checkout && { checkout }),
    ...(guests && { guests }),
    ...(memo && { memo }),
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  existing.push(reservation)
  await saveAll(placeId, existing)

  return NextResponse.json({ success: true, id: reservation.id }, { status: 201 })
}
