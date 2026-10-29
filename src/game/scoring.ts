import type { TimedNote } from '../songs/song'
import type { Hit } from './judge'
import { SCORING, type ModeSettings } from './settings'

export type Rating = 'perfect' | 'great' | 'good'

export interface Results {
  score: number
  counts: Record<Rating, number>
  accuracy: number
  progress: number
  won: boolean
}

const ACCURACY_WEIGHT: Record<Rating, number> = { perfect: 1, great: 0.66, good: 0.33 }

export function rate(offsetMs: number, s: ModeSettings): Rating {
  const abs = Math.abs(offsetMs)
  if (abs <= s.startWindowMs * SCORING.perfectFrac) return 'perfect'
  if (abs <= s.startWindowMs * SCORING.greatFrac) return 'great'
  return 'good'
}

export function computeResults(
  tiles: TimedNote[],
  hits: Hit[],
  won: boolean,
  s: ModeSettings,
): Results {
  const byIndex = new Map(tiles.map((t) => [t.index, t]))
  const counts: Record<Rating, number> = { perfect: 0, great: 0, good: 0 }
  let score = 0
  let combo = 0
  let weighted = 0
  let counted = 0

  for (const hit of hits) {
    const tile = byIndex.get(hit.index)
    if (!tile) continue
    counted++
    const rating = rate(hit.offsetMs, s)
    counts[rating]++
    weighted += ACCURACY_WEIGHT[rating]
    score += SCORING.points[rating]
    if (rating === 'perfect') {
      combo++
      score += Math.min((combo - 1) * SCORING.comboStep, SCORING.comboCap)
    } else {
      combo = 0
    }
    if (hit.fullHold && tile.endMs - tile.startMs >= SCORING.holdTileMinMs) {
      score += SCORING.holdBonus
    }
  }

  const total = tiles.length
  return {
    score,
    counts,
    accuracy: total === 0 ? 0 : (100 * weighted) / total,
    progress: total === 0 ? 0 : (100 * counted) / total,
    won,
  }
}
