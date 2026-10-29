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
 * - While a note is on, a "gap" is any stretch of frames that are not the current note
 *   at healthy volume. A frame has *lost volume* when rms < minRms or rms < dipRatio ×
 *   the note's running peak.
 *   - Wobble: a gap in which the volume never dropped (only clarity or pitch were bad,
 *     e.g. a breathy frame or an octave error) is the note still sounding. When the same
 *     note returns nothing is emitted, however long the gap lasted. Recorder mode must
 *     not lose a player on notes played correctly (spec anti-goal), and a wobble mistaken
 *     for a re-attack would release a held tile early.
 *   - Release: volume lost continuously for releaseMs (seen on an invalid frame) →
 *     noteOff at the gap start.
 *   - Re-attack: a gap with any volume loss (a tongue dip, short silence) followed by
 *     the same note → noteOff at the gap start, noteOn(same) at the first recovered frame.
 *     Both are reported only once the same note has held steadyMs after recovery; a
 *     change to another note cancels it.
 *   "Gap start" is the first frame of the gap, i.e. the earlier of where the dip and
 *   where the invalid run began.
 */
export class NoteTracker {
  private readonly sink: NoteEvents
  private readonly s: TrackerSettings
  private _current: NoteName | null = null
  /** Run of a valid note that is not (yet) the current one. */
  private candidate: { note: NoteName; t: number } | null = null
  /**
   * The current gap while a note is on: its first frame, and whether the volume dropped
   * anywhere in it (only then can it be a re-attack).
   */
  private gap: { start: number; lostVolume: boolean } | null = null
  /** First frame of the current unbroken run of volume-loss frames (release clock). */
  private quietSince: number | null = null
  private runningPeak = 0
  /**
   * A gap recovered to the same note, waiting for that note to hold steadyMs before it
   * is reported (times are still the gap start and recovery frame).
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

    if (this._current === null) {
      if (note === null) this.candidate = null
      else this.track(note, f)
      return
    }

    const lostVolume = f.rms < this.s.minRms || f.rms < this.s.dipRatio * this.runningPeak

    if (note === this._current) {
      this.candidate = null
      if (this.reattack !== null) {
        this.gap = null
        this.quietSince = null
        if (f.t - this.reattack.onAt >= this.s.steadyMs) {
          this.sink.noteOff(this.reattack.offAt)
          this.onset(note, this.reattack.onAt, f.rms)
        }
      } else if (lostVolume) {
        this.openGap(f, true)
      } else if (this.gap !== null) {
        // Recovered. Only a gap where the volume dropped is a re-attack; otherwise wobble.
        if (this.gap.lostVolume) this.reattack = { offAt: this.gap.start, onAt: f.t }
        this.gap = null
        this.quietSince = null
      } else {
        this.runningPeak = Math.max(this.runningPeak, f.rms)
      }
      return
    }

    if (note !== null) {
      // Another valid note: onset of a change once steady (it does not open a gap).
      this.track(note, f)
      return
    }

    this.candidate = null
    this.openGap(f, lostVolume)
    if (this.quietSince !== null && f.t - this.quietSince >= this.s.releaseMs) {
      this.sink.noteOff(this.reattack?.offAt ?? this.gap!.start)
      this._current = null
      this.reset()
    }
  }

  /** Records a frame that is part of a gap (not the current note at healthy volume). */
  private openGap(f: Frame, lostVolume: boolean): void {
    this.gap ??= { start: f.t, lostVolume: false }
    if (lostVolume) {
      this.gap.lostVolume = true
      this.quietSince ??= f.t
    } else {
      this.quietSince = null
    }
  }

  /** A valid note that is not the current one: onset or change once steady. */
  private track(note: NoteName, f: Frame): void {
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
    this.gap = null
    this.quietSince = null
    this.reattack = null
  }

  private noteOf(f: Frame): NoteName | null {
    if (f.clarity < this.s.minClarity || f.rms < this.s.minRms) return null
    return frequencyToNote(f.pitchHz)?.note ?? null
  }
}
