import type { NoteName } from './notes'

/** closed = covered, open = uncovered, half = half-covered (thumb: pinched; holes 6/7: big hole only). */
export type Hole = 'closed' | 'open' | 'half'

export interface Fingering {
  /** The thumb hole on the back. */
  thumb: Hole
  /** Front holes 1–7, top (left index finger) to bottom (right little finger). */
  holes: readonly [Hole, Hole, Hole, Hole, Hole, Hole, Hole]
}

const C = 'closed' as const
const O = 'open' as const
const H = 'half' as const

const f = (thumb: Hole, ...holes: Fingering['holes']): Fingering => ({ thumb, holes })

/**
 * Baroque fingerings for a soprano recorder, written pitch. Only notes where published
 * charts agree are listed; the rest (G#4, A#4, C#5, D#5 and most of the top octave)
 * vary between charts and recorders, so they are left out rather than guessed.
 */
const FINGERINGS: Partial<Record<NoteName, Fingering>> = {
  C4: f(C, C, C, C, C, C, C, C),
  'C#4': f(C, C, C, C, C, C, C, H),
  D4: f(C, C, C, C, C, C, C, O),
  'D#4': f(C, C, C, C, C, C, H, O),
  E4: f(C, C, C, C, C, C, O, O),
  F4: f(C, C, C, C, C, O, C, C),
  'F#4': f(C, C, C, C, O, C, C, O),
  G4: f(C, C, C, C, O, O, O, O),
  A4: f(C, C, C, O, O, O, O, O),
  B4: f(C, C, O, O, O, O, O, O),
  C5: f(C, O, C, O, O, O, O, O),
  D5: f(O, O, C, O, O, O, O, O),
  E5: f(H, C, C, C, C, C, O, O),
  G5: f(H, C, C, C, O, O, O, O),
  A5: f(H, C, C, O, O, O, O, O),
}

export function fingeringFor(note: NoteName): Fingering | null {
  return FINGERINGS[note] ?? null
}
