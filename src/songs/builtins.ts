import type { NoteName } from '../music/notes'
import type { Song, SongNote } from './song'

type Step = [note: NoteName, beats?: number]

/** Lay steps end to end (default one beat each) starting at beat 0. */
function sequence(steps: Step[]): SongNote[] {
  let startBeat = 0
  return steps.map(([note, beats = 1]) => {
    const n = { note, startBeat, beats }
    startBeat += beats
    return n
  })
}

const hotCrossBuns: Step[] = [
  ['B4'], ['A4'], ['G4', 2],
  ['B4'], ['A4'], ['G4', 2],
  ['G4', 0.5], ['G4', 0.5], ['G4', 0.5], ['G4', 0.5],
  ['A4', 0.5], ['A4', 0.5], ['A4', 0.5], ['A4', 0.5],
  ['B4'], ['A4'], ['G4', 2],
]

const mary: Step[] = [
  ['B4'], ['A4'], ['G4'], ['A4'],
  ['B4'], ['B4'], ['B4', 2],
  ['A4'], ['A4'], ['A4', 2],
  ['B4'], ['D5'], ['D5', 2],
  ['B4'], ['A4'], ['G4'], ['A4'],
  ['B4'], ['B4'], ['B4'], ['B4'],
  ['A4'], ['A4'], ['B4'], ['A4'],
  ['G4', 4],
]

export const BUILTIN_SONGS: Song[] = [
  { id: 'hot-cross-buns', name: 'Hot Cross Buns', bpm: 90, builtIn: true, notes: sequence(hotCrossBuns) },
  { id: 'mary-had-a-little-lamb', name: 'Mary Had a Little Lamb', bpm: 90, builtIn: true, notes: sequence(mary) },
]
