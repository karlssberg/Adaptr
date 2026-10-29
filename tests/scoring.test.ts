import { describe, expect, it } from 'vitest'
import { SETTINGS } from '../src/game/settings'
import { computeResults, rate } from '../src/game/scoring'
import type { Hit } from '../src/game/judge'
import type { TimedNote } from '../src/songs/song'

const tiles: TimedNote[] = [
  { index: 0, note: 'G4', startMs: 0, endMs: 1000 },
  { index: 1, note: 'A4', startMs: 1000, endMs: 2000 },
  { index: 2, note: 'A4', startMs: 2000, endMs: 3000 },
]
const perfectHits: Hit[] = [0, 1, 2].map((index) => ({ index, offsetMs: 0, fullHold: true }))

describe('rate', () => {
  it('bands scale with the mode window', () => {
    expect(rate(52, SETTINGS.keyboard)).toBe('perfect')
    expect(rate(-53, SETTINGS.keyboard)).toBe('great')
    expect(rate(106, SETTINGS.keyboard)).toBe('good')
    expect(rate(87, SETTINGS.recorder)).toBe('perfect')
  })
})

describe('computeResults', () => {
  it('scores perfects with combo and hold bonuses', () => {
    const r = computeResults(tiles, perfectHits, true, SETTINGS.keyboard)
    expect(r.score).toBe(1080)
    expect(r.counts).toEqual({ perfect: 3, great: 0, good: 0 })
    expect(r.accuracy).toBe(100)
    expect(r.progress).toBe(100)
    expect(r.won).toBe(true)
  })

  it('reports progress when lost early', () => {
    expect(computeResults(tiles, [perfectHits[0]], false, SETTINGS.keyboard)).toMatchObject({
      progress: 100 / 3,
      won: false,
    })
  })

  it('a non-perfect resets the combo', () => {
    const hits: Hit[] = [
      { index: 0, offsetMs: 0, fullHold: false },
      { index: 1, offsetMs: 60, fullHold: false },
      { index: 2, offsetMs: 0, fullHold: false },
    ]
    const r = computeResults(tiles, hits, true, SETTINGS.keyboard)
    expect(r.score).toBe(300 + 200 + 300)
    expect(r.counts).toEqual({ perfect: 2, great: 1, good: 0 })
    expect(r.accuracy).toBeCloseTo((100 * (1 + 0.66 + 1)) / 3)
  })

  it('caps the combo bonus', () => {
    const many: TimedNote[] = Array.from({ length: 15 }, (_, i) => ({
      index: i, note: 'G4', startMs: i * 100, endMs: i * 100 + 100,
    }))
    const hits: Hit[] = many.map((t) => ({ index: t.index, offsetMs: 0, fullHold: true }))
    const bonus = Array.from({ length: 15 }, (_, i) => Math.min(i * 10, 100)).reduce((a, b) => a + b, 0)
    expect(computeResults(many, hits, true, SETTINGS.keyboard).score).toBe(15 * 300 + bonus)
  })

  it('awards no hold bonus on short tiles and handles empty input', () => {
    const short: TimedNote[] = [{ index: 0, note: 'G4', startMs: 0, endMs: 300 }]
    const hits: Hit[] = [{ index: 0, offsetMs: 0, fullHold: true }]
    expect(computeResults(short, hits, true, SETTINGS.keyboard).score).toBe(300)
    expect(computeResults([], [], false, SETTINGS.keyboard)).toMatchObject({ accuracy: 0, progress: 0, score: 0 })
  })

  it('ignores hits with no tile', () => {
    const hits: Hit[] = [{ index: 9, offsetMs: 0, fullHold: true }]
    expect(computeResults(tiles, hits, false, SETTINGS.keyboard)).toMatchObject({ score: 0, progress: 0 })
  })
})
