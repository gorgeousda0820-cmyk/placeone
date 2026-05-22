'use client'

import { useState } from 'react'
import type { CategoryType } from '@/types'

interface Props {
  placeId: string
  categoryType: CategoryType
  accentColor: string
  ctaText: string
}

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00',
]
const GUEST_OPTIONS = ['1명', '2명', '3명', '4명', '5명', '6명 이상']

type Fields = {
  name: string; phone: string; date: string; checkin: string
  checkout: string; time: string; guests: string; memo: string
}

const inputBase =
  'bf-input w-full border rounded-xl px-4 text-[16px] placeholder:text-gray-300 outline-none transition-colors bg-white'

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block mb-2" style={{ color: '#111111', fontSize: 18, fontWeight: 700 }}>
      {children}
    </label>
  )
}

export default function BookingForm({ placeId, categoryType, accentColor, ctaText }: Props) {
  const [fields, setFields] = useState<Fields>({
    name: '', phone: '', date: '', checkin: '', checkout: '', time: '', guests: '', memo: '',
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const isAccom = categoryType === 'accommodation'
  const isFood = categoryType === 'food'

  function set(key: keyof Fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setErrorMsg(null)
      setFields((prev) => ({ ...prev, [key]: e.target.value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId, ...fields }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? '예약 접수 중 오류가 발생했습니다. 전화로 문의해주세요.')
        setStatus('idle')
        return
      }
      setStatus('success')
    } catch {
      setErrorMsg('예약 접수 중 오류가 발생했습니다. 전화로 문의해주세요.')
      setStatus('idle')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-10 space-y-3">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-3xl"
          style={{ backgroundColor: `${accentColor}18` }}
        >
          ✅
        </div>
        <p className="text-[18px] font-bold text-gray-900">예약이 접수되었습니다!</p>
        <p className="text-[15px] text-gray-500">사장님이 확인 후 연락드립니다 😊</p>
      </div>
    )
  }

  const inputStyle = { height: 52, borderColor: '#DDDDDD' }
  const selectStyle = { height: 52, borderColor: '#DDDDDD' }

  return (
    <>
      {/* 포커스 시 포인트 컬러 적용 */}
      <style dangerouslySetInnerHTML={{ __html: `
        .bf-input:focus {
          border-color: ${accentColor} !important;
          box-shadow: 0 0 0 3px ${accentColor}22 !important;
        }
      `}} />

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 이름 + 연락처 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>이름</Label>
            <input required type="text" value={fields.name} onChange={set('name')}
              placeholder="홍길동" className={inputBase} style={inputStyle} />
          </div>
          <div>
            <Label>연락처</Label>
            <input required type="tel" value={fields.phone} onChange={set('phone')}
              placeholder="010-0000-0000" className={inputBase} style={inputStyle} />
          </div>
        </div>

        {/* 숙소: 체크인 + 체크아웃 */}
        {isAccom && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>체크인</Label>
              <input required type="date" min={today} value={fields.checkin}
                onChange={set('checkin')} className={inputBase} style={inputStyle} />
            </div>
            <div>
              <Label>체크아웃</Label>
              <input required type="date" min={fields.checkin || today} value={fields.checkout}
                onChange={set('checkout')} className={inputBase} style={inputStyle} />
            </div>
          </div>
        )}

        {/* 일반: 날짜 + 시간 */}
        {!isAccom && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>날짜</Label>
              <input required type="date" min={today} value={fields.date}
                onChange={set('date')} className={inputBase} style={inputStyle} />
            </div>
            <div>
              <Label>시간</Label>
              <select required value={fields.time} onChange={set('time')}
                className={inputBase} style={selectStyle}>
                <option value="">선택</option>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* 인원 (숙소/음식점) */}
        {(isAccom || isFood) && (
          <div>
            <Label>인원</Label>
            <select required value={fields.guests} onChange={set('guests')}
              className={inputBase} style={selectStyle}>
              <option value="">선택</option>
              {GUEST_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        )}

        {/* 메모 */}
        <div>
          <Label>메모 (선택)</Label>
          <textarea
            value={fields.memo}
            onChange={set('memo')}
            placeholder="요청사항이나 참고 사항을 적어주세요"
            rows={3}
            className="bf-input w-full border rounded-xl px-4 py-3 text-[16px] placeholder:text-gray-300 outline-none transition-colors bg-white resize-none"
            style={{ borderColor: '#DDDDDD' }}
          />
        </div>

        {/* 에러 */}
        {errorMsg && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <span className="text-red-500 flex-shrink-0 mt-0.5">⚠️</span>
            <p className="text-[14px] text-red-600 leading-snug">{errorMsg}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full rounded-2xl text-white text-[24px] font-bold transition-opacity disabled:opacity-60 hover:opacity-90"
          style={{ height: 64, backgroundColor: accentColor }}
        >
          {status === 'loading' ? '접수 중...' : ctaText}
        </button>

      </form>
    </>
  )
}
