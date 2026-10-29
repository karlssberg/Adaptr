import { describe, expect, test } from 'vitest'
import { STEP_BEATS, extendTo, newSong, toggleCell } from '../src/editor/editorModel'
import { validateSong, type SongNote } from '../src/songs/song'

const S = STEP_BEATS

describe('toggleCell', () => {
  test('adds a one-step note on an empty cell', () => {
    expect(toggleCell([], 'C4', 3)).toEqual([{ note: 'C4', startBeat: 3 * S, beats: S }])
  })

  test('clicking the same cell again removes the note', () => {
    expect(toggleCell(toggleCell([], 'C4', 3), 'C4', 3)).toEqual([])
  })

  test('a cell inside a longer note removes that note', () => {
    const notes: SongNote[] = [{ note: 'C4', startBeat: 0, beats: 2 }]
    expect(toggleCell(notes, 'C4', 2)).toEqual([])
  })

  test('adding at a row covered by a note in another column replaces it', () => {
    const notes: SongNote[] = [{ note: 'C4', startBeat: 0, beats: 2 }]
    expect(toggleCell(notes, 'E4', 1)).toEqual([{ note: 'E4', startBeat: S, beats: S }])
  })

  test('does not mutate its input', () => {
    const notes: SongNote[] = [{ note: 'C4', startBeat: 0, beats: S }]
    toggleCell(notes, 'C4', 0)
    expect(notes).toHaveLength(1)
  })
})

describe('extendTo', () => {
  test('grows a note to reach the row', () => {
    const notes: SongNote[] = [{ note: 'C4', startBeat: 0, beats: S }]
    expect(extendTo(notes, 0, 3)).toEqual([{ note: 'C4', startBeat: 0, beats: 4 * S }])
  })

  test('shrinks but never below one step', () => {
    const notes: SongNote[] = [{ note: 'C4', startBeat: 2 * S, beats: 4 * S }]
    expect(extendTo(notes, 0, 3)[0].beats).toBe(2 * S)
    expect(extendTo(notes, 0, 0)[0].beats).toBe(S)
  })

  test('is refused when it would overlap the next note', () => {
    const notes: SongNote[] = [
      { note: 'C4', startBeat: 0, beats: S },
      { note: 'D4', startBeat: 3 * S, beats: S },
    ]
    expect(extendTo(notes, 0, 3)).toBe(notes)
    expect(extendTo(notes, 0, 2)[0].beats).toBe(3 * S)
  })
})

describe('validity', () => {
  test('any op sequence yields a valid non-empty song', () => {
    let notes: SongNote[] = []
    const ops: [string, number][] = [['C4', 0], ['E4', 1], ['G4', 2], ['G4', 2], ['A4', 2], ['C5', 5], ['E4', 0]]
    for (const [n, r] of ops) {
      notes = toggleCell(notes, n, r)
      if (notes.length > 0) {
        notes = extendTo(notes, notes.length - 1, r + 2)
        expect(validateSong({ ...newSong(), notes })).toBe(true)
      }
    }
    expect(notes.length).toBeGreaterThan(0)
  })

  test('newSong defaults', () => {
    const s = newSong()
    expect(s).toMatchObject({ name: 'My song', bpm: 90, notes: [] })
    expect(s.id).toMatch(/^user-\d+$/)
  })
})
