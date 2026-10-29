import type { Mode } from '../game/settings'
import { validateSong, type Song } from './song'

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const SONGS_KEY = 'recorder-tiles:songs'
const BEST_KEY = 'recorder-tiles:best'

type BestMap = Record<string, { keyboard?: number; recorder?: number }>

export function safeLocalStorage(): KeyValueStore | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

function readSongs(st: KeyValueStore): Song[] {
  const raw = st.getItem(SONGS_KEY)
  if (raw === null) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(validateSong)
}

function readBest(st: KeyValueStore): BestMap {
  const raw = st.getItem(BEST_KEY)
  if (raw === null) return {}
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
  return parsed as BestMap
}

export function loadUserSongs(st: KeyValueStore | null): Song[] {
  if (!st) return []
  try {
    return readSongs(st)
  } catch {
    return []
  }
}

export function saveUserSong(st: KeyValueStore | null, song: Song): boolean {
  if (!st || song.builtIn || !validateSong(song)) return false
  try {
    const songs = readSongsOrEmpty(st)
    const i = songs.findIndex((s) => s.id === song.id)
    if (i >= 0) songs[i] = song
    else songs.push(song)
    st.setItem(SONGS_KEY, JSON.stringify(songs))
    return true
  } catch {
    return false
  }
}

function readSongsOrEmpty(st: KeyValueStore): Song[] {
  try {
    return readSongs(st)
  } catch (e) {
    // Corrupt JSON is treated as empty; a throwing store is rethrown.
    if (e instanceof SyntaxError) return []
    throw e
  }
}

export function deleteUserSong(st: KeyValueStore | null, id: string): boolean {
  if (!st) return false
  try {
    const songs = readSongsOrEmpty(st)
    st.setItem(SONGS_KEY, JSON.stringify(songs.filter((s) => s.id !== id)))
    return true
  } catch {
    return false
  }
}

function scoreOf(map: BestMap, songId: string, mode: Mode): number | null {
  const entry = map[songId]
  const v = typeof entry === 'object' && entry !== null ? entry[mode] : undefined
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function getBest(st: KeyValueStore | null, songId: string, mode: Mode): number | null {
  if (!st) return null
  try {
    return scoreOf(readBest(st), songId, mode)
  } catch {
    return null
  }
}

export function recordScore(
  st: KeyValueStore | null,
  songId: string,
  mode: Mode,
  score: number,
): boolean {
  if (!st) return false
  try {
    let map: BestMap
    try {
      map = readBest(st)
    } catch (e) {
      if (e instanceof SyntaxError) map = {}
      else throw e
    }
    const prev = scoreOf(map, songId, mode)
    if (prev !== null && score <= prev) return false
    const entry = typeof map[songId] === 'object' && map[songId] !== null ? map[songId] : {}
    map[songId] = { ...entry, [mode]: score }
    st.setItem(BEST_KEY, JSON.stringify(map))
    return true
  } catch {
    return false
  }
}
