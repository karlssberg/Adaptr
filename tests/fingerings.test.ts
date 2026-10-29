import { describe, expect, test } from 'vitest'
import { fingeringFor } from '../src/music/fingerings'
import { BUILTIN_SONGS } from '../src/songs/builtins'
import { laneNotes } from '../src/songs/song'

describe('fingeringFor', () => {
  test('beginner notes', () => {
    expect(fingeringFor('B4')).toEqual({ thumb: 'closed', holes: ['closed', 'open', 'open', 'open', 'open', 'open', 'open'] })
    expect(fingeringFor('A4')!.holes.slice(0, 3)).toEqual(['closed', 'closed', 'open'])
    expect(fingeringFor('G4')!.holes.slice(0, 4)).toEqual(['closed', 'closed', 'closed', 'open'])
  })

  test('high D has the thumb off and only hole 2 covered', () => {
    expect(fingeringFor('D5')).toEqual({ thumb: 'open', holes: ['open', 'closed', 'open', 'open', 'open', 'open', 'open'] })
  })

  test('baroque F is forked: hole 5 open, 6 and 7 closed', () => {
    expect(fingeringFor('F4')!.holes).toEqual(['closed', 'closed', 'closed', 'closed', 'open', 'closed', 'closed'])
  })

  test('upper notes pinch the thumb', () => {
    expect(fingeringFor('E5')!.thumb).toBe('half')
  })

  test('notes the charts disagree on have no fingering', () => {
    expect(fingeringFor('G#4')).toBeNull()
    expect(fingeringFor('D6')).toBeNull()
  })

  test('every note in the built-in songs has a fingering', () => {
    for (const song of BUILTIN_SONGS) for (const n of laneNotes(song)) expect(fingeringFor(n), n).not.toBeNull()
  })
})
