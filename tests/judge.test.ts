import { describe, expect, test } from 'vitest'
import { Judge } from '../src/game/judge'
import { SETTINGS } from '../src/game/settings'
import type { TimedNote } from '../src/songs/song'

const tiles: TimedNote[] = [
  { index: 0, note: 'G4', startMs: 0, endMs: 1000 },
  { index: 1, note: 'A4', startMs: 1000, endMs: 2000 },
  { index: 2, note: 'A4', startMs: 2000, endMs: 3000 },
]

const judge = () => new Judge(tiles, SETTINGS.keyboard)

describe('settings', () => {
  test('mode settings', () => {
    expect(SETTINGS.keyboard).toEqual({ startWindowMs: 150, endAllowanceMs: 150, tickLagMs: 30 })
    expect(SETTINGS.recorder).toEqual({ startWindowMs: 250, endAllowanceMs: 200, tickLagMs: 150 })
  })
})

describe('judge', () => {
  test('clean run wins with full holds', () => {
    const j = judge()
    j.noteOn('G4', 0)
    j.noteOff(1000)
    j.noteOn('A4', 1000)
    j.noteOff(2000)
    j.noteOn('A4', 2000)
    expect(j.status).toBe('playing')
    j.noteOff(3000)
    expect(j.status).toBe('won')
    expect(j.loss).toBeUndefined()
    expect(j.hits).toEqual([
      { index: 0, offsetMs: 0, fullHold: true },
      { index: 1, offsetMs: 0, fullHold: true },
      { index: 2, offsetMs: 0, fullHold: true },
    ])
  })

  test('wins via tick while holding the last tile', () => {
    const j = judge()
    j.noteOn('G4', 0)
    j.noteOn('A4', 1000)
    j.noteOff(2000)
    j.noteOn('A4', 2000)
    j.tick(2999)
    expect(j.status).toBe('playing')
    j.tick(3000)
    expect(j.status).toBe('won')
    expect(j.hits.every((h) => h.fullHold)).toBe(true)
  })

  test('wrong note loses', () => {
    const j = judge()
    j.noteOn('B4', 0)
    expect(j.status).toBe('lost')
    expect(j.loss).toEqual({ reason: 'wrong-note', index: 0, atMs: 0 })
    expect(j.hits).toEqual([])
  })

  test('too early / too late', () => {
    const early = judge()
    early.noteOn('G4', -151)
    expect(early.status).toBe('lost')
    expect(early.loss).toEqual({ reason: 'too-early', index: 0, atMs: -151 })

    const late = judge()
    late.tick(150)
    expect(late.status).toBe('playing')
    late.tick(151)
    expect(late.status).toBe('lost')
    expect(late.loss).toEqual({ reason: 'too-late', index: 0, atMs: 151 })

    const lateOn = judge()
    lateOn.noteOn('G4', 151)
    expect(lateOn.loss).toEqual({ reason: 'too-late', index: 0, atMs: 151 })
  })

  test('edge of window is a hit', () => {
    const j = judge()
    j.noteOn('G4', 150)
    expect(j.status).toBe('playing')
    expect(j.hits[0].offsetMs).toBe(150)

    const e = judge()
    e.noteOn('G4', -150)
    expect(e.status).toBe('playing')
    expect(e.hits[0].offsetMs).toBe(-150)
  })

  test('release before allowance loses', () => {
    const j = judge()
    j.noteOn('G4', 0)
    j.noteOff(849)
    expect(j.status).toBe('lost')
    expect(j.loss).toEqual({ reason: 'released-early', index: 0, atMs: 849 })

    const ok = judge()
    ok.noteOn('G4', 0)
    ok.noteOff(850)
    expect(ok.status).toBe('playing')
    expect(ok.hits[0].fullHold).toBe(false)
  })

  test('implicit release by a new note can lose released-early', () => {
    const j = judge()
    j.noteOn('G4', 0)
    j.noteOn('A4', 849)
    expect(j.loss).toEqual({ reason: 'released-early', index: 0, atMs: 849 })
    expect(j.hits).toHaveLength(1)
  })

  test('holding past end is fine', () => {
    const j = judge()
    j.noteOn('G4', 0)
    j.tick(1100)
    expect(j.status).toBe('playing')
    expect(j.hits[0].fullHold).toBe(true)
    j.noteOn('A4', 1100)
    expect(j.status).toBe('playing')
    expect(j.hits[1]).toEqual({ index: 1, offsetMs: 100, fullHold: false })
  })

  test('holding through a repeated note loses', () => {
    const j = judge()
    j.noteOn('G4', 0)
    j.noteOn('A4', 1000)
    j.tick(2150)
    expect(j.status).toBe('playing')
    j.tick(2151)
    expect(j.status).toBe('lost')
    expect(j.loss).toEqual({ reason: 'too-late', index: 2, atMs: 2151 })
  })

  test('still sounding a different note loses wrong-note', () => {
    const j = judge()
    j.noteOn('G4', 0)
    j.tick(1151)
    expect(j.status).toBe('lost')
    expect(j.loss).toEqual({ reason: 'wrong-note', index: 1, atMs: 1151 })
  })

  test('noteOn after game over is ignored', () => {
    const j = judge()
    j.noteOn('B4', 0)
    const loss = j.loss
    j.noteOn('G4', 10)
    j.noteOff(500)
    j.tick(5000)
    expect(j.status).toBe('lost')
    expect(j.loss).toEqual(loss)
    expect(j.hits).toEqual([])

    const w = judge()
    w.noteOn('G4', 0)
    w.noteOn('A4', 1000)
    w.noteOn('A4', 2000)
    w.noteOff(3000)
    expect(w.status).toBe('won')
    w.noteOn('B4', 3100)
    w.tick(9999)
    expect(w.status).toBe('won')
    expect(w.loss).toBeUndefined()
  })
})
