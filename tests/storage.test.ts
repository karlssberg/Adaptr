import { describe, it, expect } from 'vitest'
import {
  loadUserSongs,
  saveUserSong,
  deleteUserSong,
  getBest,
  recordScore,
  type KeyValueStore,
} from '../src/songs/storage'
import type { Song } from '../src/songs/song'

function fakeStore(initial: Record<string, string> = {}): KeyValueStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

const throwing: KeyValueStore = {
  getItem: () => {
    throw new Error('denied')
  },
  setItem: () => {
    throw new Error('quota')
  },
  removeItem: () => {
    throw new Error('denied')
  },
}

const song = (id: string, extra: Partial<Song> = {}): Song => ({
  id,
  name: `Song ${id}`,
  bpm: 100,
  notes: [{ note: 'C5', startBeat: 0, beats: 1 }],
  ...extra,
})

describe('user songs', () => {
  it('round-trips and replaces by id', () => {
    const st = fakeStore()
    expect(saveUserSong(st, song('a'))).toBe(true)
    expect(saveUserSong(st, song('b'))).toBe(true)
    expect(saveUserSong(st, song('a', { name: 'Renamed' }))).toBe(true)
    const loaded = loadUserSongs(st)
    expect(loaded).toHaveLength(2)
    expect(loaded.find((s) => s.id === 'a')?.name).toBe('Renamed')
  })

  it('returns [] for null, throwing, and corrupt storage', () => {
    expect(loadUserSongs(null)).toEqual([])
    expect(loadUserSongs(throwing)).toEqual([])
    expect(loadUserSongs(fakeStore({ 'recorder-tiles:songs': '{not json' }))).toEqual([])
    expect(loadUserSongs(fakeStore({ 'recorder-tiles:songs': '{"a":1}' }))).toEqual([])
  })

  it('skips invalid entries', () => {
    const st = fakeStore({
      'recorder-tiles:songs': JSON.stringify([song('ok'), { id: 'bad' }]),
    })
    expect(loadUserSongs(st).map((s) => s.id)).toEqual(['ok'])
  })

  it('refuses built-in and invalid songs', () => {
    const st = fakeStore()
    expect(saveUserSong(st, song('x', { builtIn: true }))).toBe(false)
    expect(saveUserSong(st, { id: 'y' } as unknown as Song)).toBe(false)
    expect(loadUserSongs(st)).toEqual([])
  })

  it('save returns false for null or throwing storage', () => {
    expect(saveUserSong(null, song('a'))).toBe(false)
    expect(saveUserSong(throwing, song('a'))).toBe(false)
  })

  it('deletes by id', () => {
    const st = fakeStore()
    saveUserSong(st, song('a'))
    saveUserSong(st, song('b'))
    expect(deleteUserSong(st, 'a')).toBe(true)
    expect(loadUserSongs(st).map((s) => s.id)).toEqual(['b'])
    expect(deleteUserSong(null, 'b')).toBe(false)
    expect(deleteUserSong(throwing, 'b')).toBe(false)
  })
})

describe('best scores', () => {
  it('is null when nothing recorded or storage unusable', () => {
    expect(getBest(fakeStore(), 's', 'keyboard')).toBeNull()
    expect(getBest(null, 's', 'keyboard')).toBeNull()
    expect(getBest(throwing, 's', 'keyboard')).toBeNull()
    expect(getBest(fakeStore({ 'recorder-tiles:best': '{not json' }), 's', 'keyboard')).toBeNull()
  })

  it('keeps modes independent', () => {
    const st = fakeStore()
    expect(recordScore(st, 's', 'keyboard', 500)).toBe(true)
    expect(getBest(st, 's', 'recorder')).toBeNull()
    expect(recordScore(st, 's', 'recorder', 200)).toBe(true)
    expect(getBest(st, 's', 'keyboard')).toBe(500)
    expect(getBest(st, 's', 'recorder')).toBe(200)
  })

  it('only higher scores replace the best', () => {
    const st = fakeStore()
    recordScore(st, 's', 'keyboard', 500)
    expect(recordScore(st, 's', 'keyboard', 400)).toBe(false)
    expect(recordScore(st, 's', 'keyboard', 500)).toBe(false)
    expect(getBest(st, 's', 'keyboard')).toBe(500)
    expect(recordScore(st, 's', 'keyboard', 600)).toBe(true)
    expect(getBest(st, 's', 'keyboard')).toBe(600)
  })

  it('returns false when storage fails', () => {
    expect(recordScore(null, 's', 'keyboard', 1)).toBe(false)
    expect(recordScore(throwing, 's', 'keyboard', 1)).toBe(false)
  })
})
