import { PitchDetector } from 'pitchy'
import { soundingFrequency, type NoteName } from '../music/notes'
import type { Frame } from './noteTracker'

export interface SyntheticEvent {
  note: NoteName
  startMs: number
  endMs: number
}

export interface SyntheticOptions {
  sampleRate: number
  totalMs: number
  detuneCents?: number
  /** Peak amplitude of uniform white noise over the whole buffer. */
  noise?: number
  /** Near-silence before a note that directly follows the same note (0 = held through). */
  tongueGapMs?: number
  seed?: number
}

const AMPLITUDE = 0.5
const SECOND_HARMONIC = 0.3
const RAMP_MS = 15

/** Small seeded PRNG so rendered noise is deterministic. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Back-to-back same notes get a tongue gap, or merge into one held tone when the gap is 0. */
function articulate(events: SyntheticEvent[], tongueGapMs: number): SyntheticEvent[] {
  const sorted = [...events].sort((a, b) => a.startMs - b.startMs)
  const out: SyntheticEvent[] = []
  for (const e of sorted) {
    const prev = out[out.length - 1]
    if (prev && prev.note === e.note && Math.abs(prev.endMs - e.startMs) < 1e-6) {
      if (tongueGapMs <= 0) {
        prev.endMs = e.endMs
        continue
      }
      prev.endMs -= tongueGapMs
    }
    out.push({ ...e })
  }
  return out
}

/** A crude recorder: sine fundamental + 0.3 second harmonic, 15 ms linear ramps, white noise. */
export function renderSynthetic(events: SyntheticEvent[], opts: SyntheticOptions): Float32Array {
  const { sampleRate, totalMs, detuneCents = 0, noise = 0, tongueGapMs = 0, seed = 1 } = opts
  const buf = new Float32Array(Math.round((totalMs / 1000) * sampleRate))
  const detune = 2 ** (detuneCents / 1200)
  const ramp = (RAMP_MS / 1000) * sampleRate

  for (const e of articulate(events, tongueGapMs)) {
    const w = 2 * Math.PI * soundingFrequency(e.note) * detune
    const from = Math.max(0, Math.round((e.startMs / 1000) * sampleRate))
    const to = Math.min(buf.length, Math.round((e.endMs / 1000) * sampleRate))
    for (let i = from; i < to; i++) {
      const env = Math.min(1, (i - from) / ramp, (to - i) / ramp)
      const s = i / sampleRate
      buf[i] += AMPLITUDE * env * (Math.sin(w * s) + SECOND_HARMONIC * Math.sin(2 * w * s))
    }
  }

  const rand = mulberry32(seed)
  for (let i = 0; i < buf.length; i++) buf[i] += noise * (2 * rand() - 1)
  return buf
}

/**
 * Sliding-window pitch analysis. Pitch uses the full `size` window; rms uses only the
 * newest `hop` samples of each window so a ~30 ms tongue gap shows up as a dip
 * (the live mic glue computes rms the same way). `t` is the window centre in ms.
 */
export function analyse(buf: Float32Array, sampleRate: number, hop = 512, size = 2048): Frame[] {
  const detector = PitchDetector.forFloat32Array(size)
  const frames: Frame[] = []
  for (let start = 0; start + size <= buf.length; start += hop) {
    const [pitchHz, clarity] = detector.findPitch(buf.subarray(start, start + size), sampleRate)
    let sum = 0
    for (let i = start + size - hop; i < start + size; i++) sum += buf[i] * buf[i]
    frames.push({ t: ((start + size / 2) / sampleRate) * 1000, pitchHz, clarity, rms: Math.sqrt(sum / hop) })
  }
  return frames
}
