import type { NoteName } from '../music/notes'
import type { Song, SongNote } from '../songs/song'

/** One grid row is an eighth note. */
export const STEP_BEATS = 0.5

const end = (n: SongNote) => n.startBeat + n.beats

export function newSong(): Song {
  return { id: `user-${Date.now()}`, name: 'My song', bpm: 90, notes: [] }
}

/**
 * Click on a cell. A cell inside a note of the same column removes that note;
 * an empty cell adds a one-step note and drops any note (in any column) that
 * overlaps that row, so the song stays monophonic.
 */
export function toggleCell(notes: SongNote[], note: NoteName, row: number): SongNote[] {
  const t0 = row * STEP_BEATS
  const t1 = t0 + STEP_BEATS
  const hit = notes.findIndex((n) => n.note === note && n.startBeat <= t0 && t0 < end(n))
  if (hit >= 0) return notes.filter((_, i) => i !== hit)
  const kept = notes.filter((n) => !(n.startBeat < t1 && end(n) > t0))
  return [...kept, { note, startBeat: t0, beats: STEP_BEATS }]
}

/** Sets note `index` to end at `row` (inclusive, at least one step); refused if it would overlap. */
export function extendTo(notes: SongNote[], index: number, row: number): SongNote[] {
  const target = notes[index]
  if (!target) return notes
  const beats = Math.max(STEP_BEATS, (row + 1) * STEP_BEATS - target.startBeat)
  const newEnd = target.startBeat + beats
  const clash = notes.some((n, i) => i !== index && n.startBeat < newEnd && end(n) > target.startBeat)
  if (clash) return notes
  return notes.map((n, i) => (i === index ? { ...n, beats } : n))
}
