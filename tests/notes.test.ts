import { describe, expect, it } from 'vitest'
import {
  RECORDER_NOTES,
  frequencyToNote,
  letterOf,
  midiToNote,
  noteToMidi,
  soundingFrequency,
} from '../src/music/notes'

describe('notes', () => {
  it('has the recorder range C4..D6', () => {
    expect(RECORDER_NOTES).toHaveLength(27)
    expect(RECORDER_NOTES[0]).toBe('C4')
    expect(RECORDER_NOTES.at(-1)).toBe('D6')
  })
  it('converts note <-> midi', () => {
    expect(noteToMidi('C4')).toBe(60)
    expect(midiToNote(61)).toBe('C#4')
  })
  it('computes sounding frequency an octave up', () => {
    expect(soundingFrequency('A4')).toBeCloseTo(880, 3)
  })
  it('maps frequency to written note', () => {
    expect(frequencyToNote(880)).toEqual({ note: 'A4', cents: 0 })
    expect(frequencyToNote(880 * 2 ** (30 / 1200))!.note).toBe('A4')
    expect(frequencyToNote(440)).toBeNull()
  })
  it('extracts the letter', () => {
    expect(letterOf('F#5')).toBe('F#')
  })
})
