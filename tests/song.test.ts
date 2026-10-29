import { describe, expect, it } from 'vitest'
import { BUILTIN_SONGS } from '../src/songs/builtins'
import { laneLabels, laneNotes, toTimedNotes, validateSong, type Song } from '../src/songs/song'

const s: Song = {
  id: 'x',
  name: 'x',
  bpm: 60,
  notes: [
    { note: 'G4', startBeat: 0, beats: 1 },
    { note: 'B4', startBeat: 1, beats: 2 },
  ],
}

describe('song', () => {
  it('converts to timed notes', () => {
    expect(toTimedNotes(s)[1]).toEqual({ index: 1, note: 'B4', startMs: 1000, endMs: 3000 })
  })
  it('sorts timed notes by start', () => {
    const rev = { ...s, notes: [...s.notes].reverse() }
    expect(toTimedNotes(rev).map((t) => t.note)).toEqual(['G4', 'B4'])
  })
  it('lists lanes low to high', () => {
    expect(laneNotes(s)).toEqual(['G4', 'B4'])
  })
  it('labels lanes', () => {
    expect(laneLabels(['D4', 'G4', 'D5'])).toEqual(['D4', 'G', 'D5'])
    expect(laneLabels(['C4', 'C#4'])).toEqual(['C', 'C#'])
  })
  it('validates', () => {
    expect(validateSong(s)).toBe(true)
    expect(validateSong({ ...s, notes: [...s.notes, { note: 'A4', startBeat: 2, beats: 1 }] })).toBe(false)
    expect(validateSong({ ...s, notes: [...s.notes, { note: 'A4', startBeat: 3, beats: 1 }] })).toBe(true)
    expect(validateSong({ ...s, notes: [{ note: 'C7', startBeat: 0, beats: 1 }] })).toBe(false)
    expect(validateSong({ ...s, notes: [{ note: 'H9', startBeat: 0, beats: 1 }] })).toBe(false)
    expect(validateSong({ ...s, notes: [{ note: 'G4', startBeat: 0, beats: 0 }] })).toBe(false)
    expect(validateSong({ ...s, notes: [] })).toBe(false)
    expect(validateSong({ ...s, bpm: 29 })).toBe(false)
    expect(validateSong({ ...s, bpm: 241 })).toBe(false)
    expect(validateSong({ ...s, name: undefined })).toBe(false)
    expect(validateSong('nonsense')).toBe(false)
    expect(validateSong(null)).toBe(false)
  })
  it('built-ins are valid', () => {
    expect(BUILTIN_SONGS.map((b) => b.id)).toEqual(['hot-cross-buns', 'mary-had-a-little-lamb'])
    for (const b of BUILTIN_SONGS) {
      expect(validateSong(b)).toBe(true)
      expect(b.builtIn).toBe(true)
      expect(b.bpm).toBe(90)
    }
    expect(laneNotes(BUILTIN_SONGS[0])).toEqual(['G4', 'A4', 'B4'])
    expect(laneNotes(BUILTIN_SONGS[1])).toEqual(['G4', 'A4', 'B4', 'D5'])
  })
})
