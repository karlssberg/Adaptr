import { RECORDER_NOTES, letterOf, noteToMidi, type NoteName } from '../music/notes'

export interface SongNote {
  note: NoteName
  startBeat: number
  beats: number
}

export interface Song {
  id: string
  name: string
  bpm: number
  notes: SongNote[]
  builtIn?: boolean
}

export interface TimedNote {
  index: number
  note: NoteName
  startMs: number
  endMs: number
}

function isSongNote(n: unknown): n is SongNote {
  if (typeof n !== 'object' || n === null) return false
  const { note, startBeat, beats } = n as Record<string, unknown>
  return (
    typeof note === 'string' &&
    RECORDER_NOTES.includes(note) &&
    typeof startBeat === 'number' &&
    Number.isFinite(startBeat) &&
    startBeat >= 0 &&
    typeof beats === 'number' &&
    Number.isFinite(beats) &&
    beats > 0
  )
}

export function validateSong(s: unknown): s is Song {
  if (typeof s !== 'object' || s === null) return false
  const { id, name, bpm, notes } = s as Record<string, unknown>
  if (typeof id !== 'string' || typeof name !== 'string') return false
  if (typeof bpm !== 'number' || !(bpm >= 30 && bpm <= 240)) return false
  if (!Array.isArray(notes) || notes.length === 0 || !notes.every(isSongNote)) return false
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startBeat < sorted[i - 1].startBeat + sorted[i - 1].beats) return false
  }
  return true
}

export function toTimedNotes(s: Song): TimedNote[] {
  const ms = (beat: number) => (beat * 60000) / s.bpm
  return [...s.notes]
    .sort((a, b) => a.startBeat - b.startBeat)
    .map((n, index) => ({
      index,
      note: n.note,
      startMs: ms(n.startBeat),
      endMs: ms(n.startBeat + n.beats),
    }))
}

export function laneNotes(s: Song): NoteName[] {
  return [...new Set(s.notes.map((n) => n.note))].sort((a, b) => noteToMidi(a) - noteToMidi(b))
}

export function laneLabels(lanes: NoteName[]): string[] {
  const counts = new Map<string, number>()
  for (const n of lanes) counts.set(letterOf(n), (counts.get(letterOf(n)) ?? 0) + 1)
  return lanes.map((n) => (counts.get(letterOf(n))! > 1 ? n : letterOf(n)))
}
