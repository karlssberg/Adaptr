import { describe, expect, test } from 'vitest'
import { KEY_ROWS, createKeyHandler, keysForLanes } from '../src/input/keyboard'

const setup = () => {
  const calls: string[] = []
  const h = createKeyHandler(['G4', 'A4', 'B4'], {
    noteOn: (n, t) => calls.push(`on ${n} ${t}`),
    noteOff: (t) => calls.push(`off ${t}`),
  })
  const down = (key: string, t = 0, repeat = false) => h.keydown({ key, repeat, timeStamp: t })
  const up = (key: string, t = 0) => h.keyup({ key, timeStamp: t })
  return { calls, down, up }
}

describe('keysForLanes', () => {
  test('first N keys', () => {
    expect(keysForLanes(3)).toEqual(['a', 's', 'd'])
    expect(keysForLanes(KEY_ROWS.length)).toHaveLength(30)
  })
  test('too many lanes throws', () => {
    expect(() => keysForLanes(KEY_ROWS.length + 1)).toThrow(RangeError)
  })
})

describe('createKeyHandler', () => {
  test('keydown emits noteOn with timestamp', () => {
    const s = setup()
    s.down('a', 5)
    expect(s.calls).toEqual(['on G4 5'])
  })
  test('repeat and unmapped keys ignored', () => {
    const s = setup()
    s.down('a', 1, true)
    s.down('z')
    s.up('z')
    expect(s.calls).toEqual([])
  })
  test('shifted letter maps like lowercase', () => {
    const s = setup()
    s.down('A', 1)
    expect(s.calls).toEqual(['on G4 1'])
  })
  test('keyup of non-sounding key ignored; sounding key releases', () => {
    const s = setup()
    s.down('a', 1)
    s.down('s', 2)
    s.up('a', 3)
    expect(s.calls).toEqual(['on G4 1', 'on A4 2'])
    s.up('s', 4)
    expect(s.calls).toEqual(['on G4 1', 'on A4 2', 'off 4'])
    s.up('s', 5)
    expect(s.calls).toHaveLength(3)
  })
  test('re-press of sounding key releases then re-attacks', () => {
    const s = setup()
    s.down('a', 1)
    s.down('a', 2)
    expect(s.calls).toEqual(['on G4 1', 'off 2', 'on G4 2'])
  })
})
