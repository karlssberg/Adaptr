import { describe, expect, it } from 'vitest'
import { GameSession, LEAD_IN_MS } from '../src/game/session'
import { SETTINGS } from '../src/game/settings'
import { computeResults } from '../src/game/scoring'
import { toTimedNotes, type Song } from '../src/songs/song'

const song: Song = {
  id: 't',
  name: 'Test',
  bpm: 60,
  notes: [
    { note: 'G4', startBeat: 0, beats: 1 },
    { note: 'A4', startBeat: 1, beats: 1 },
  ],
}
const START = 10_000
const T0 = START + LEAD_IN_MS

describe('GameSession', () => {
  it('offsets song times by startAt + LEAD_IN_MS', () => {
    const s = new GameSession(song, 'keyboard', START)
    expect(s.tiles.map((t) => [t.startMs, t.endMs])).toEqual([
      [T0, T0 + 1000],
      [T0 + 1000, T0 + 2000],
    ])
    // A press at the original song time (0) is far too early once shifted.
    s.noteOn('G4', START)
    expect(s.status).toBe('lost')
    expect(s.judge.loss?.reason).toBe('too-early')
  })

  it('a note on time with the shifted start is a hit', () => {
    const s = new GameSession(song, 'keyboard', START)
    s.noteOn('G4', T0 + 10)
    expect(s.judge.hits).toEqual([{ index: 0, offsetMs: 10, fullHold: false }])
    expect(s.status).toBe('playing')
  })

  it('abandon() sets status abandoned and later ticks do not lose', () => {
    const s = new GameSession(song, 'keyboard', START)
    s.abandon()
    expect(s.status).toBe('abandoned')
    s.tick(T0 + 100_000)
    s.noteOn('C4', T0 + 100_000)
    expect(s.status).toBe('abandoned')
    expect(s.judge.status).toBe('playing')
  })

  it('results() after a win match computeResults', () => {
    const s = new GameSession(song, 'keyboard', START)
    s.noteOn('G4', T0)
    s.noteOn('A4', T0 + 1000 + 60)
    s.tick(T0 + 2000 + SETTINGS.keyboard.tickLagMs)
    expect(s.status).toBe('won')
    const expected = computeResults(
      s.tiles,
      s.judge.hits,
      true,
      SETTINGS.keyboard,
    )
    expect(s.results()).toEqual(expected)
    expect(s.results().won).toBe(true)
    expect(s.results().counts).toEqual({ perfect: 1, great: 1, good: 0 })
    expect(s.tiles).toEqual(
      toTimedNotes(song).map((t) => ({ ...t, startMs: t.startMs + T0, endMs: t.endMs + T0 })),
    )
  })

  it('tracks the sounding note for the lit lane', () => {
    const s = new GameSession(song, 'keyboard', START)
    expect(s.sounding).toBeNull()
    s.noteOn('G4', T0)
    expect(s.sounding).toBe('G4')
    s.noteOff(T0 + 1000)
    expect(s.sounding).toBeNull()
  })

  it('recorder mode ticks the judge tickLagMs behind, so a late tracker noteOn still hits', () => {
    const s = new GameSession(song, 'recorder', START)
    s.tick(T0 + 280)
    expect(s.status).toBe('playing')
    s.noteOn('G4', T0 + 200)
    expect(s.status).toBe('playing')
    expect(s.judge.hits).toEqual([{ index: 0, offsetMs: 200, fullHold: false }])
  })

  it('recorder mode survives a ~50 ms frame gap near the late edge', () => {
    // Player starts at T0+240 (inside the 250 ms window). The tracker reports it after
    // steadyMs (40) + half the analysis window (~23) + a 50 ms gap in mic frames, so the
    // event lands around T0+353; the game loop may tick once more (T0+370) before it.
    const s = new GameSession(song, 'recorder', START)
    s.tick(T0 + 370)
    expect(s.status).toBe('playing')
    s.noteOn('G4', T0 + 240)
    expect(s.status).toBe('playing')
    expect(s.judge.hits).toEqual([{ index: 0, offsetMs: 240, fullHold: false }])
  })

  it('keyboard mode ticks 30 ms behind, so a keydown queued behind a frame still counts', () => {
    const s = new GameSession(song, 'keyboard', START)
    s.tick(T0 + 175)
    expect(s.status).toBe('playing')
    s.noteOn('G4', T0 + 145)
    expect(s.judge.hits).toEqual([{ index: 0, offsetMs: 145, fullHold: false }])
  })

  it('keyboard mode still loses too-late once the lagged tick passes the window', () => {
    const s = new GameSession(song, 'keyboard', START)
    s.tick(T0 + 181)
    expect(s.status).toBe('lost')
    expect(s.judge.loss?.reason).toBe('too-late')
  })
})
