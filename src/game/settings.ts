export type Mode = 'keyboard' | 'recorder'

export interface ModeSettings {
  startWindowMs: number
  endAllowanceMs: number
}

export const SETTINGS: Record<Mode, ModeSettings> = {
  keyboard: { startWindowMs: 150, endAllowanceMs: 150 },
  recorder: { startWindowMs: 250, endAllowanceMs: 200 },
}
