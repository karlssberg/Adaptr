export interface TrackerSettings {
  /** Minimum pitchy clarity for a frame to count as a note. */
  minClarity: number
  /** Minimum frame rms (short recent window) for a frame to count as a note. */
  minRms: number
  /** A note (or a change to another note) must be valid this long to start. */
  steadyMs: number
  /** Invalid this long while a note is on → release. */
  releaseMs: number
  /** rms below dipRatio × the note's running peak is a tongued dip. */
  dipRatio: number
}

export const TRACKER: TrackerSettings = {
  minClarity: 0.9,
  minRms: 0.01,
  steadyMs: 40,
  releaseMs: 60,
  dipRatio: 0.4,
}
