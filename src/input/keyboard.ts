import type { NoteName } from '../music/notes'

export const KEY_ROWS = 'asdfghjkl;' + 'qwertyuiop' + '1234567890'

export interface NoteEvents {
  noteOn(note: NoteName, t: number): void
  noteOff(t: number): void
}

export function keysForLanes(count: number): string[] {
  if (count > KEY_ROWS.length) {
    throw new RangeError(`at most ${KEY_ROWS.length} lanes supported, got ${count}`)
  }
  return KEY_ROWS.slice(0, count).split('')
}

export function createKeyHandler(
  lanes: NoteName[],
  sink: NoteEvents,
): {
  keydown(e: { key: string; repeat: boolean; timeStamp: number }): void
  keyup(e: { key: string; timeStamp: number }): void
} {
  const keys = keysForLanes(lanes.length)
  let sounding: string | null = null

  return {
    keydown(e) {
      if (e.repeat) return
      const key = e.key.toLowerCase()
      const lane = keys.indexOf(key)
      if (lane < 0) return
      if (sounding === key) sink.noteOff(e.timeStamp)
      sounding = key
      sink.noteOn(lanes[lane], e.timeStamp)
    },
    keyup(e) {
      const key = e.key.toLowerCase()
      if (key !== sounding) return
      sounding = null
      sink.noteOff(e.timeStamp)
    },
  }
}
