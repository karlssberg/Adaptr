export type NoteName = string

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** Written pitch: C4 = MIDI 60. Recorder sounds an octave above written. */
export function noteToMidi(n: NoteName): number {
  const m = /^([A-G]#?)(-?\d+)$/.exec(n)
  if (!m) throw new Error(`Invalid note name: ${n}`)
  return NAMES.indexOf(m[1] as (typeof NAMES)[number]) + (Number(m[2]) + 1) * 12
}

export function midiToNote(m: number): NoteName {
  return `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`
}

export const RECORDER_NOTES: readonly NoteName[] = Array.from(
  { length: noteToMidi('D6') - noteToMidi('C4') + 1 },
  (_, i) => midiToNote(60 + i),
)

/** Frequency in Hz of the sounding pitch (written + 12 semitones), A4 = 440. */
export function soundingFrequency(n: NoteName): number {
  return 440 * 2 ** ((noteToMidi(n) + 12 - 69) / 12)
}

/** Nearest written note for a sounding frequency; null if outside RECORDER_NOTES. */
export function frequencyToNote(hz: number): { note: NoteName; cents: number } | null {
  if (!(hz > 0) || !Number.isFinite(hz)) return null
  const soundingMidi = 69 + 12 * Math.log2(hz / 440)
  const nearest = Math.round(soundingMidi)
  const note = midiToNote(nearest - 12)
  if (!RECORDER_NOTES.includes(note)) return null
  return { note, cents: Math.round((soundingMidi - nearest) * 100) || 0 }
}

export function letterOf(n: NoteName): string {
  return n.replace(/-?\d+$/, '')
}
