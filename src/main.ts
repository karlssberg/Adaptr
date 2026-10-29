import './style.css'
import { mountGame } from './ui/gameScreen'
import { mountEditor } from './ui/editorScreen'
import { loadMode, mountMenu, saveMode } from './ui/menuScreen'
import { newSong } from './editor/editorModel'
import { mountMicCheck } from './ui/micCheckScreen'
import { mountResults } from './ui/resultsScreen'
import type { Mode } from './game/settings'
import { BUILTIN_SONGS } from './songs/builtins'
import type { Song } from './songs/song'
import { getBest, loadUserSongs, recordScore, safeLocalStorage } from './songs/storage'

const root = document.querySelector<HTMLDivElement>('#app')!
let cleanup: (() => void) | null = null
/** The menu's mode, kept here too so it survives a localStorage that throws. */
let mode: Mode = loadMode()

function show(mount: () => (() => void) | void): void {
  cleanup?.()
  cleanup = null
  root.replaceChildren()
  cleanup = mount() ?? null
}

function showMenu(): void {
  show(() => {
    const st = safeLocalStorage()
    mountMenu(root, [...BUILTIN_SONGS, ...loadUserSongs(st)], (id, m) => getBest(st, id, m), mode, {
      play: (song, m) => showGame(song, m),
      micCheck: showMicCheck,
      edit: (song) => showEditor(song),
      setMode: (m) => {
        mode = m
        saveMode(m)
      },
    })
  })
}

/**
 * Plays `song`. With `backToEditor` (a Try it from the editor) every way out returns to
 * the editor instead of the menu, and no best score is recorded for the draft.
 */
function showGame(song: Song, gameMode: Mode, backToEditor?: () => void): void {
  const back = backToEditor ?? showMenu
  show(() =>
    mountGame(root, song, gameMode, (results, loss) => {
      if (!results) {
        back()
        return
      }
      const isNewBest = backToEditor ? false : recordScore(safeLocalStorage(), song.id, gameMode, results.score)
      show(() => {
        mountResults(root, song, gameMode, results, loss, isNewBest, backToEditor ? 'editor' : 'menu', {
          retry: () => showGame(song, gameMode, backToEditor),
          back,
        })
      })
    }),
  )
}

function showMicCheck(): void {
  show(() => mountMicCheck(root, showMenu))
}

function showEditor(song?: Song, dirty = false): void {
  show(() =>
    mountEditor(root, song ?? newSong(), dirty, {
      tryIt: (s, unsaved) => showGame(s, mode, () => showEditor(s, unsaved)),
      back: showMenu,
    }),
  )
}

showMenu()
