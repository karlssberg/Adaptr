import type { NoteEvents } from '../input/keyboard'
import { frequencyToNote, type NoteName } from '../music/notes'
import { TRACKER, type TrackerSettings } from './trackerSettings'

export interface Frame {
  /** Time in ms (window centre). */
  t: number
  pitchHz: number
  clarity: number
  /** rms of a short recent window (the newest hop), so a tongue gap is visible. */
  rms: number
}

/**
 * Turns a stream of pitch frames into noteOn/noteOff events.
 *
 * - Onset: the same valid note for steadyMs; noteOn is timed at the run's first frame.
 * - Change: another valid note held for steadyMs → noteOn(new) at its first frame
 *   (the judge treats it as an implicit release). Shorter changes are wobble.
 * - Release: invalid for releaseMs → noteOff at the first invalid frame.
 * - Re-attack (while on): an rms dip below dipRatio × running peak, or an invalid run
 *   shorter than releaseMs, followed by the same note → noteOff at the dip/gap start,
 *   noteOn(same) at the first recovered frame. Both are reported only once the same
 *   note has held steadyMs after recovery; a change to another note cancels it.
 */
export class NoteTracker {
  private readonly sink: NoteEvents
  private readonly s: TrackerSettings
  private _current: NoteName | null = null
  /** Run of a valid note that is not (yet) the current one. */
  private candidate: { note: NoteName; t: number } | null = null
  /** First frame of the current invalid run while a note is on. */
  private invalidSince: number | null = null
  /** First frame of the current rms dip while a note is on. */
  private dipSince: number | null = null
  private runningPeak = 0
  /**
   * A dip or short gap recovered to the same note, waiting for that note to hold
   * steadyMs before it is reported (times are still the dip start and recovery frame).
   * Without this, a different-note transition is misread as a re-attack: the 15 ms
   * release/attack ramps make an rms dip, and the newest hop recovers on the new note
   * while the 2048-sample pitch window still reports the old one (seen in Hot Cross
   * Buns B4→A4: a spurious noteOn(B4) at the A4 tile → wrong-note).
   */
  private reattack: { offAt: number; onAt: number } | null = null

  constructor(sink: NoteEvents, s: TrackerSettings = TRACKER) {
    this.sink = sink
    this.s = s
  }

  get current(): NoteName | null {
    return this._current
  }

  push(f: Frame): void {
    const note = this.noteOf(f)

    if (note === null) {
      this.candidate = null
      if (this._current === null) return
      this.invalidSince ??= f.t
      if (f.t - this.invalidSince >= this.s.releaseMs) {
        this.sink.noteOff(this.reattack?.offAt ?? this.invalidSince)
        this._current = null
        this.reset()
      }
      return
    }

    if (note === this._current) {
      this.candidate = null
      if (this.reattack !== null) {
        this.invalidSince = null
        if (f.t - this.reattack.onAt >= this.s.steadyMs) {
          this.sink.noteOff(this.reattack.offAt)
          this.onset(note, this.reattack.onAt, f.rms)
        }
      } else if (this.invalidSince !== null || (this.dipSince !== null && !this.isDip(f))) {
        this.reattack = { offAt: (this.invalidSince ?? this.dipSince)!, onAt: f.t }
        this.invalidSince = null
        this.dipSince = null
      } else if (this.isDip(f)) {
        this.dipSince ??= f.t
      } else {
        this.runningPeak = Math.max(this.runningPeak, f.rms)
      }
      return
    }

    // A valid note that is not the current one: onset or change once steady.
    if (this.candidate?.note !== note) this.candidate = { note, t: f.t }
    if (f.t - this.candidate.t >= this.s.steadyMs) {
      this.onset(note, this.candidate.t, f.rms)
    }
  }

  private onset(note: NoteName, t: number, rms: number): void {
    this.sink.noteOn(note, t)
    this._current = note
    this.reset()
    this.runningPeak = rms
  }

  private reset(): void {
    this.candidate = null
    this.invalidSince = null
    this.dipSince = null
    this.reattack = null
  }

  private isDip(f: Frame): boolean {
    return f.rms < this.s.dipRatio * this.runningPeak
  }

  private noteOf(f: Frame): NoteName | null {
    if (f.clarity < this.s.minClarity || f.rms < this.s.minRms) return null
    return frequencyToNote(f.pitchHz)?.note ?? null
  }
}
