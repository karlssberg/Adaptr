import { describe, expect, test } from 'vitest'
import { NoteTracker, type Frame } from '../src/audio/noteTracker'
import { analyse, renderSynthetic } from '../src/audio/synthetic'
import { Judge } from '../src/game/judge'
import { SETTINGS } from '../src/game/settings'
import { BUILTIN_SONGS } from '../src/songs/builtins'
import { toTimedNotes, type Song, type TimedNote } from '../src/songs/song'

const SAMPLE_RATE = 44100
const LEAD_IN_MS = 500

interface PlayOptions {
  tongueGapMs: number
  replace?: { index: number; note: string }
  detuneCents?: number
  seed?: number
  /** Rewrites analysed frames before they reach the tracker (e.g. inject wobble). */
  mutate?: (frames: Frame[], tiles: TimedNote[]) => void
}

function play(song: Song, opts: PlayOptions) {
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
    detuneCents: opts.detuneCents ?? 20,
    noise: 0.02,
    tongueGapMs: opts.tongueGapMs,
    seed: opts.seed ?? 1,
  })
  const judge = new Judge(tiles, SETTINGS.recorder)
  const tracker = new NoteTracker(judge)
  const frames = analyse(buf, SAMPLE_RATE)
  opts.mutate?.(frames, tiles)
  for (const f of frames) {
    tracker.push(f)
    judge.tick(f.t)
  }
  judge.tick(totalMs)
  return judge
}

/** Deterministic PRNG for picking which frames to corrupt. */
function lcg(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0
    return a / 4294967296
  }
}

const hotCrossBuns = BUILTIN_SONGS.find((s) => s.id === 'hot-cross-buns')!

describe('detection pipeline on synthetic recorder audio', () => {
  test.each(BUILTIN_SONGS.map((s) => [s.name, s] as const))('%s played correctly wins', (_, song) => {
    const judge = play(song, { tongueGapMs: 30 })
    expect(judge.loss).toBeUndefined()
    expect(judge.status).toBe('won')
  })

  test.each(BUILTIN_SONGS.map((s) => [s.name, s] as const))(
    '%s still wins with mid-note low-clarity / octave-error frames',
    (_, song) => {
      let corrupted = 0
      const judge = play(song, {
        tongueGapMs: 30,
        mutate: (frames, tiles) => {
          const rand = lcg(7)
          for (const tile of tiles) {
            // Only frames well inside the tile, where the tone is steady and loud.
            const inside = frames.filter((f) => f.t > tile.startMs + 80 && f.t < tile.endMs - 80)
            if (inside.length === 0) continue
            const f = inside[Math.floor(rand() * inside.length)]
            if (rand() < 0.5) f.clarity = 0.3
            else f.pitchHz /= 2 // octave error: below the recorder's range
            corrupted++
          }
        },
      })
      expect(corrupted).toBeGreaterThan(10)
      expect(judge.loss).toBeUndefined()
      expect(judge.status).toBe('won')
    },
  )

  test('held-through repeats (no tongue gap) lose too-late on the first repeated note', () => {
    const judge = play(hotCrossBuns, { tongueGapMs: 0 })
    const tiles = toTimedNotes(hotCrossBuns)
    const firstRepeat = tiles.findIndex((t, i) => i > 0 && tiles[i - 1].note === t.note)
    expect(firstRepeat).toBe(6)
    expect(judge.status).toBe('lost')
    expect(judge.loss).toMatchObject({ reason: 'too-late', index: firstRepeat })
  })

  test('one wrong note loses wrong-note on that tile', () => {
    const judge = play(hotCrossBuns, { tongueGapMs: 30, replace: { index: 1, note: 'C5' } })
    expect(judge.status).toBe('lost')
    expect(judge.loss).toMatchObject({ reason: 'wrong-note', index: 1 })
  })
})

describe('robustness sweep: correct playing always wins', () => {
  const cases = BUILTIN_SONGS.flatMap((song) =>
    [1, 2, 3].flatMap((seed) =>
      [-30, 40].flatMap((detuneCents) =>
        [20, 50].map((tongueGapMs) => [song.name, seed, detuneCents, tongueGapMs, song] as const),
      ),
    ),
  )
  test.each(cases)('%s seed %i detune %i cents tongue gap %i ms', (_, seed, detuneCents, tongueGapMs, song) => {
    const judge = play(song, { tongueGapMs, detuneCents, seed })
    expect(judge.loss).toBeUndefined()
    expect(judge.status).toBe('won')
  })
})
