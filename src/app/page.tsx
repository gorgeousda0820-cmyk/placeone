'use client'

import { useState, useEffect, useRef } from 'react'

const LOADING_STEPS = [
  { icon: '🔍', text: '네이버 플레이스 접속 중...' },
  { icon: '🏪', text: '가게 정보 수집 중...' },
  { icon: '📸', text: '사진 & 리뷰 분석 중...' },
  { icon: '✨', text: '홈페이지 생성 중...' },
]

type State =
  | { status: 'idle' }
  | { status: 'loading'; stepIndex: number }
  | { status: 'success'; pageUrl: string; placeName: string }
  | { status: 'error'; message: string }

export default function Home() {
  const [url, setUrl] = useState('')
  const [state, setState] = useState<State>({ status: 'idle' })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setState({ status: 'loading', stepIndex: 0 })

    let step = 0
    intervalRef.current = setInterval(() => {
      step = Math.min(step + 1, LOADING_STEPS.length - 1)
      setState({ status: 'loading', stepIndex: step })
    }, 7000)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '오류가 발생했습니다.')
      }

      setState({ status: 'success', pageUrl: data.pageUrl, placeName: data.placeName })
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : '오류가 발생했습니다.',
      })
    } finally {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }

  function handleReset() {
    setState({ status: 'idle' })
    setUrl('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 flex flex-col font-sans">
      {/* Header */}
      <header className="flex items-center justify-center pt-10 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌸</span>
          <span className="text-lg font-bold text-rose-600 tracking-tight">PlaceOne</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <div className="w-full max-w-md">

          {/* Hero text */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold text-gray-900 leading-tight mb-3">
              플레이스 <span className="text-rose-500">원페이지</span>
            </h1>
            <p className="text-gray-500 text-base leading-relaxed">
              네이버 플레이스 URL만 넣으면<br />
              <span className="font-semibold text-rose-500">30초 만에 홈페이지 완성</span>
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-rose-100/50 p-6">

            {/* Idle / Error: show form */}
            {(state.status === 'idle' || state.status === 'error') && (
              <>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    네이버 플레이스 URL
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://m.place.naver.com/..."
                    className="w-full border-2 border-gray-100 focus:border-rose-300 rounded-xl px-4 py-3 text-sm outline-none transition-colors placeholder:text-gray-300"
                    required
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="w-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-bold py-3.5 rounded-xl transition-colors text-sm shadow-md shadow-rose-200"
                  >
                    홈페이지 만들기 →
                  </button>
                </form>

                {state.status === 'error' && (
                  <div className="mt-4 p-3.5 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-xs text-red-600 whitespace-pre-line leading-relaxed">
                      {state.message}
                    </p>
                  </div>
                )}

                <p className="text-center text-xs text-gray-400 mt-4">
                  네이버 지도 앱 &gt; 가게 공유 버튼에서 URL을 복사하세요
                </p>
              </>
            )}

            {/* Loading */}
            {state.status === 'loading' && (
              <div className="py-6 text-center space-y-5">
                {/* Spinner */}
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-full border-4 border-rose-100 border-t-rose-500 animate-spin" />
                </div>

                {/* Step indicator */}
                <div>
                  <p className="text-2xl mb-2">{LOADING_STEPS[state.stepIndex].icon}</p>
                  <p className="text-sm font-semibold text-gray-700">
                    {LOADING_STEPS[state.stepIndex].text}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">약 30초 정도 걸려요</p>
                </div>

                {/* Step dots */}
                <div className="flex justify-center gap-2">
                  {LOADING_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        i <= state.stepIndex ? 'w-5 bg-rose-400' : 'w-1.5 bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Success */}
            {state.status === 'success' && (
              <div className="py-4 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-3xl">
                  🎉
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-base">
                    홈페이지가 생성되었습니다!
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {state.placeName}
                  </p>
                </div>

                {/* Generated URL */}
                <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                  <p className="text-xs text-gray-400 mb-1">생성된 홈페이지 주소</p>
                  <p className="text-sm font-mono font-semibold text-rose-600 break-all">
                    {typeof window !== 'undefined' ? window.location.origin : ''}
                    {state.pageUrl}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    className="flex-1 py-3 rounded-xl border-2 border-rose-200 text-rose-500 font-bold text-sm hover:bg-rose-50 transition-colors"
                  >
                    새로 만들기
                  </button>
                  <a
                    href={state.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-[2] py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm transition-colors text-center"
                  >
                    홈페이지 보기 →
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Feature pills */}
          {state.status === 'idle' && (
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {['무료 제공', '30초 완성', '모바일 최적화', '네이버 예약 연동'].map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-white/70 text-gray-500 px-3 py-1.5 rounded-full border border-gray-100"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-xs text-gray-400">
          Powered by <span className="text-rose-400 font-medium">PlaceOne</span>
        </p>
      </footer>
    </div>
  )
}
