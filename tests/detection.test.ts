import { describe, expect, test } from 'vitest'
import { NoteTracker } from '../src/audio/noteTracker'
import { analyse, renderSynthetic } from '../src/audio/synthetic'
import { Judge } from '../src/game/judge'
import { SETTINGS } from '../src/game/settings'
import { BUILTIN_SONGS } from '../src/songs/builtins'
import { toTimedNotes, type Song, type TimedNote } from '../src/songs/song'

const SAMPLE_RATE = 44100
const LEAD_IN_MS = 500

function play(song: Song, opts: { tongueGapMs: number; replace?: { index: number; note: string } }) {
  const tiles: TimedNote[] = toTimedNotes(song).map((n) => ({
    ...n,
    startMs: n.startMs + LEAD_IN_MS,
    endMs: n.endMs + LEAD_IN_MS,
  }))
  const events = tiles.map((n) => ({
    note: n.index === opts.replace?.index ? opts.replace.note : n.note,
    startMs: n.startMs,
    endMs: n.endMs,
  }))
  const totalMs = tiles[tiles.length - 1].endMs + LEAD_IN_MS
  const buf = renderSynthetic(events, {
    sampleRate: SAMPLE_RATE,
    totalMs,
    detuneCents: 20,
    noise: 0.02,
    tongueGapMs: opts.tongueGapMs,
    seed: 1,
  })
  const judge = new Judge(tiles, SETTINGS.recorder)
  const tracker = new NoteTracker(judge)
  for (const f of analyse(buf, SAMPLE_RATE)) {
    tracker.push(f)
    judge.tick(f.t)
  }
  judge.tick(totalMs)
  return judge
}

const hotCrossBuns = BUILTIN_SONGS.find((s) => s.id === 'hot-cross-buns')!

describe('detection pipeline on synthetic recorder audio', () => {
  test.each(BUILTIN_SONGS.map((s) => [s.name, s] as const))('%s played correctly wins', (_, song) => {
    const judge = play(song, { tongueGapMs: 30 })
    expect(judge.loss).toBeUndefined()
    expect(judge.status).toBe('won')
  })

  test('held-through repeats (no tongue gap) lose too-late', () => {
    const judge = play(hotCrossBuns, { tongueGapMs: 0 })
    expect(judge.status).toBe('lost')
    expect(judge.loss?.reason).toBe('too-late')
  })

  test('one wrong note loses wrong-note on that tile', () => {
    const judge = play(hotCrossBuns, { tongueGapMs: 30, replace: { index: 1, note: 'C5' } })
    expect(judge.status).toBe('lost')
    expect(judge.loss).toMatchObject({ reason: 'wrong-note', index: 1 })
  })
})
