import type { NoteName } from '../music/notes'
import type { TimedNote } from '../songs/song'
import type { ModeSettings } from './settings'

export type LossReason = 'wrong-note' | 'too-early' | 'too-late' | 'released-early'

export interface Hit {
  index: number
  offsetMs: number
  fullHold: boolean
}

export type JudgeStatus = 'playing' | 'won' | 'lost'

export interface Loss {
  reason: LossReason
  index: number
  atMs: number
}

export class Judge {
  private readonly tiles: TimedNote[]
  private readonly settings: ModeSettings
  private _status: JudgeStatus = 'playing'
  private _loss: Loss | undefined
  private readonly _hits: Hit[] = []
  /** Note currently on, independent of whether its tile is complete. */
  private sounding: NoteName | null = null
  /** Index of the hit tile still being held and not yet complete. */
  private holding: number | null = null

  constructor(tiles: TimedNote[], s: ModeSettings) {
    this.tiles = tiles
    this.settings = s
  }

  get status(): JudgeStatus {
    return this._status
  }

  get loss(): Loss | undefined {
    return this._loss
  }

  get hits(): Hit[] {
    return this._hits
  }

  noteOn(note: NoteName, t: number): void {
    if (this._status !== 'playing') return
    if (this.sounding !== null) this.noteOff(t)
    if (this._status !== 'playing') return

    const index = this._hits.length
    const next = this.tiles[index]
    if (next === undefined) return this.lose('wrong-note', this.tiles.length - 1, t)

    const W = this.settings.startWindowMs
    if (note !== next.note) return this.lose('wrong-note', index, t)
    if (t < next.startMs - W) return this.lose('too-early', index, t)
    if (t > next.startMs + W) return this.lose('too-late', index, t)

    this._hits.push({ index, offsetMs: t - next.startMs, fullHold: false })
    this.sounding = note
    this.holding = index
  }

  noteOff(t: number): void {
    if (this._status !== 'playing' || this.sounding === null) return
    this.sounding = null
    if (this.holding === null) return

    const tile = this.tiles[this.holding]
    if (t < tile.endMs - this.settings.endAllowanceMs) {
      return this.lose('released-early', this.holding, t)
    }
    this.complete(t >= tile.endMs)
  }

  tick(t: number): void {
    if (this._status !== 'playing') return

    if (this.holding !== null && t >= this.tiles[this.holding].endMs) {
      this.complete(true)
      if (this._status !== 'playing') return
    }

    const index = this._hits.length
    const next = this.tiles[index]
    if (next === undefined || t <= next.startMs + this.settings.startWindowMs) return
    if (this.sounding !== null && this.sounding !== next.note) {
      this.lose('wrong-note', index, t)
    } else {
      this.lose('too-late', index, t)
    }
  }

  private complete(fullHold: boolean): void {
    if (this.holding === null) return
    this._hits[this.holding].fullHold = fullHold
    const wasLast = this.holding === this.tiles.length - 1
    this.holding = null
    if (wasLast) this._status = 'won'
  }

  private lose(reason: LossReason, index: number, atMs: number): void {
    this._status = 'lost'
    this._loss = { reason, index, atMs }
  }
}
