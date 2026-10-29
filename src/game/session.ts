import type { NoteEvents } from '../input/keyboard'
import type { NoteName } from '../music/notes'
import { toTimedNotes, type Song, type TimedNote } from '../songs/song'
import { Judge, type JudgeStatus } from './judge'
import { computeResults, type Results } from './scoring'
import { SETTINGS, type Mode, type ModeSettings } from './settings'

/** The first tile reaches the hit line this long after start. */
export const LEAD_IN_MS = 3000
/** How long a tile is visible before it reaches the hit line. */
export const FALL_MS = 2000

/** One play of a song: the judge on tiles shifted to the performance.now() clock. */
export class GameSession implements NoteEvents {
  readonly judge: Judge
  readonly tiles: TimedNote[]
  readonly settings: ModeSettings
  private abandoned = false
  private _sounding: NoteName | null = null

  constructor(song: Song, mode: Mode, startAt: number) {
    const offset = startAt + LEAD_IN_MS
    this.settings = SETTINGS[mode]
    this.tiles = toTimedNotes(song).map((t) => ({
      ...t,
      startMs: t.startMs + offset,
      endMs: t.endMs + offset,
    }))
    this.judge = new Judge(this.tiles, this.settings)
  }

  get status(): JudgeStatus | 'abandoned' {
    return this.abandoned ? 'abandoned' : this.judge.status
  }

  /** The note currently sounding (for the lit lane), or null. */
  get sounding(): NoteName | null {
    return this._sounding
  }

  noteOn(note: NoteName, t: number): void {
    if (this.status !== 'playing') return
    this._sounding = note
    this.judge.noteOn(note, t)
  }

  noteOff(t: number): void {
    if (this.status !== 'playing') return
    this._sounding = null
    this.judge.noteOff(t)
  }

  tick(now: number): void {
    if (this.status !== 'playing') return
    this.judge.tick(now)
  }

  abandon(): void {
    if (this.status === 'playing') this.abandoned = true
  }

  results(): Results {
    return computeResults(this.tiles, this.judge.hits, this.judge.status === 'won', this.settings)
  }
}
