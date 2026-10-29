import { describe, expect, test } from 'vitest'
import { NoteTracker, type Frame } from '../src/audio/noteTracker'
import { TRACKER } from '../src/audio/trackerSettings'
import { soundingFrequency, type NoteName } from '../src/music/notes'

type Ev = ['on', NoteName, number] | ['off', number]

function setup() {
  const events: Ev[] = []
  const tracker = new NoteTracker({
    noteOn: (note, t) => events.push(['on', note, t]),
    noteOff: (t) => events.push(['off', t]),
  })
  return { events, tracker }
}

const STEP = 10

/** Frames every 10 ms over [from, to). */
function frames(from: number, to: number, f: Partial<Frame> & { note?: NoteName | null }): Frame[] {
  const out: Frame[] = []
  const pitchHz = f.note === null ? 0 : soundingFrequency(f.note ?? 'A4')
  for (let t = from; t < to; t += STEP) {
    out.push({ t, pitchHz: f.pitchHz ?? pitchHz, clarity: f.clarity ?? 0.98, rms: f.rms ?? 0.3 })
  }
  return out
}

const silence = (from: number, to: number) => frames(from, to, { note: null, clarity: 0.1, rms: 0.001 })

describe('tracker settings', () => {
  test('values', () => {
    expect(TRACKER).toEqual({ minClarity: 0.9, minRms: 0.01, steadyMs: 40, releaseMs: 60, dipRatio: 0.4 })
  })
})

describe('NoteTracker', () => {
  test('steady A4 turns on after steadyMs, timed at the first frame', () => {
    const { events, tracker } = setup()
    for (const f of frames(0, 30, {})) tracker.push(f)
    expect(events).toEqual([])
    expect(tracker.current).toBeNull()
    for (const f of frames(30, 200, {})) tracker.push(f)
    expect(events).toEqual([['on', 'A4', 0]])
    expect(tracker.current).toBe('A4')
  })

  test('a 20 ms blip of another note is ignored', () => {
    const { events, tracker } = setup()
    for (const f of [...frames(0, 200, {}), ...frames(200, 220, { note: 'B4' }), ...frames(220, 400, {})]) {
      tracker.push(f)
    }
    expect(events).toEqual([['on', 'A4', 0]])
    expect(tracker.current).toBe('A4')
  })

  test('a held change to another note fires noteOn at its first frame', () => {
    const { events, tracker } = setup()
    for (const f of [...frames(0, 200, {}), ...frames(200, 400, { note: 'B4' })]) tracker.push(f)
    expect(events).toEqual([['on', 'A4', 0], ['on', 'B4', 200]])
    expect(tracker.current).toBe('B4')
  })

  test('80 ms of silence releases at the first silent frame', () => {
    const { events, tracker } = setup()
    for (const f of [...frames(0, 200, {}), ...silence(200, 280)]) tracker.push(f)
    expect(events).toEqual([['on', 'A4', 0], ['off', 200]])
    expect(tracker.current).toBeNull()
  })

  test('an rms dip to 0.3x and back is a re-attack', () => {
    const { events, tracker } = setup()
    const all = [...frames(0, 200, {}), ...frames(200, 230, { rms: 0.09 }), ...frames(230, 400, {})]
    for (const f of all) tracker.push(f)
    expect(events).toEqual([['on', 'A4', 0], ['off', 200], ['on', 'A4', 230]])
    expect(tracker.current).toBe('A4')
  })

  test('a dip that recovers on the old pitch but moves to a new note is a change, not a re-attack', () => {
    // Transition ramps dip the rms; the newest hop recovers on the new note while the
    // long pitch window still reports the old one for a frame.
    const { events, tracker } = setup()
    const all = [
      ...frames(0, 200, {}),
      ...frames(200, 220, { rms: 0.09 }),
      ...frames(220, 230, {}),
      ...frames(230, 400, { note: 'B4' }),
    ]
    for (const f of all) tracker.push(f)
    expect(events).toEqual([['on', 'A4', 0], ['on', 'B4', 230]])
  })

  test('a short invalid gap followed by the same note is a re-attack', () => {
    const { events, tracker } = setup()
    for (const f of [...frames(0, 200, {}), ...silence(200, 230), ...frames(230, 400, {})]) tracker.push(f)
    expect(events).toEqual([['on', 'A4', 0], ['off', 200], ['on', 'A4', 230]])
  })

  // Mid-note wobble: one bad frame (clarity or pitch) while the volume stays up must not
  // become a re-attack — a re-attack would release the held tile early ("released-early").
  test('a single low-clarity frame with healthy rms mid-note emits nothing', () => {
    const { events, tracker } = setup()
    const all = [...frames(0, 200, {}), ...frames(200, 210, { clarity: 0.5 }), ...frames(210, 400, {})]
    for (const f of all) tracker.push(f)
    expect(events).toEqual([['on', 'A4', 0]])
    expect(tracker.current).toBe('A4')
  })

  test('a single out-of-range pitch frame (octave error) with healthy rms mid-note emits nothing', () => {
    const { events, tracker } = setup()
    const all = [...frames(0, 200, {}), ...frames(200, 210, { pitchHz: 200 }), ...frames(210, 400, {})]
    for (const f of all) tracker.push(f)
    expect(events).toEqual([['on', 'A4', 0]])
  })

  test('three consecutive low-clarity frames with healthy rms emit nothing', () => {
    const { events, tracker } = setup()
    const all = [...frames(0, 200, {}), ...frames(200, 230, { clarity: 0.5 }), ...frames(230, 400, {})]
    for (const f of all) tracker.push(f)
    expect(events).toEqual([['on', 'A4', 0]])
  })

  test('a long low-clarity run with healthy rms is still sounding, not a release', () => {
    const { events, tracker } = setup()
    const all = [...frames(0, 200, {}), ...frames(200, 400, { clarity: 0.5 }), ...frames(400, 500, {})]
    for (const f of all) tracker.push(f)
    expect(events).toEqual([['on', 'A4', 0]])
    expect(tracker.current).toBe('A4')
  })

  test('a wobble frame then a quiet gap then the same note re-attacks from the wobble frame', () => {
    const { events, tracker } = setup()
    const all = [
      ...frames(0, 200, {}),
      ...frames(200, 210, { clarity: 0.5 }),
      ...silence(210, 230),
      ...frames(230, 400, {}),
    ]
    for (const f of all) tracker.push(f)
    expect(events).toEqual([['on', 'A4', 0], ['off', 200], ['on', 'A4', 230]])
  })

  test('a dip followed by silence releases at the dip start (the earlier of the two)', () => {
    const { events, tracker } = setup()
    for (const f of [...frames(0, 200, {}), ...frames(200, 220, { rms: 0.09 }), ...silence(220, 320)]) {
      tracker.push(f)
    }
    expect(events).toEqual([['on', 'A4', 0], ['off', 200]])
    expect(tracker.current).toBeNull()
  })

  test('low-clarity frames never start a note', () => {
    const { events, tracker } = setup()
    for (const f of frames(0, 500, { clarity: 0.5 })) tracker.push(f)
    expect(events).toEqual([])
    expect(tracker.current).toBeNull()
  })

  test('quiet frames never start a note', () => {
    const { events, tracker } = setup()
    for (const f of frames(0, 500, { rms: 0.005 })) tracker.push(f)
    expect(events).toEqual([])
  })

  test('out-of-range pitch never starts a note', () => {
    const { events, tracker } = setup()
    for (const f of frames(0, 500, { pitchHz: 100 })) tracker.push(f)
    expect(events).toEqual([])
  })
})
