export type Mode = 'keyboard' | 'recorder'

export interface ModeSettings {
  startWindowMs: number
  endAllowanceMs: number
  /** The judge's tick runs this far behind real time so late-reported input events still count. */
  tickLagMs: number
}

export const SETTINGS: Record<Mode, ModeSettings> = {
  // tickLagMs: a keydown can be queued behind a rAF tick, so its timeStamp predates the tick.
  keyboard: { startWindowMs: 150, endAllowanceMs: 150, tickLagMs: 30 },
  // tickLagMs covers the tracker's steadyMs (40) + half the analysis window (~23 ms) + gaps
  // between mic frames of up to ~80 ms (a dropped rAF or two).
  recorder: { startWindowMs: 250, endAllowanceMs: 200, tickLagMs: 150 },
}

export const SCORING = {
  perfectFrac: 0.35,
  greatFrac: 0.7,
  points: { perfect: 300, great: 200, good: 100 },
  comboStep: 10,
  comboCap: 100,
  holdBonus: 50,
  holdTileMinMs: 400,
}
