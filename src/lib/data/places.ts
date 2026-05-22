import fs from 'fs/promises'
import path from 'path'
import type { NaverPlaceInfo } from '@/types'

export interface GeneratedPage {
  placeId: string
  slug: string
  data: NaverPlaceInfo
  createdAt: string
}

export async function getGeneratedPage(slug: string): Promise<GeneratedPage | null> {
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'places', `${slug}.json`)
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as GeneratedPage
  } catch {
    return null
  }
}
