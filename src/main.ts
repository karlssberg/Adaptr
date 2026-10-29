import './style.css'
import { mountGame } from './ui/gameScreen'
import { mountEditor } from './ui/editorScreen'
import { loadMode, mountMenu } from './ui/menuScreen'
import { newSong } from './editor/editorModel'
import { mountMicCheck } from './ui/micCheckScreen'
import { mountResults } from './ui/resultsScreen'
import type { Mode } from './game/settings'
import { BUILTIN_SONGS } from './songs/builtins'
import type { Song } from './songs/song'
import { getBest, loadUserSongs, recordScore, safeLocalStorage } from './songs/storage'

const root = document.querySelector<HTMLDivElement>('#app')!
let cleanup: (() => void) | null = null

function show(mount: () => (() => void) | void): void {
  cleanup?.()
  cleanup = null
  root.replaceChildren()
  cleanup = mount() ?? null
}

function showMenu(): void {
  show(() => {
    const st = safeLocalStorage()
    mountMenu(root, [...BUILTIN_SONGS, ...loadUserSongs(st)], (id, m) => getBest(st, id, m), {
      play: showGame,
      micCheck: showMicCheck,
      edit: showEditor,
    })
  })
}

function showGame(song: Song, mode: Mode): void {
  show(() =>
    mountGame(root, song, mode, (results, loss) => {
      if (!results) {
        showMenu()
        return
      }
      const isNewBest = recordScore(safeLocalStorage(), song.id, mode, results.score)
      show(() => {
        mountResults(root, song, mode, results, loss, isNewBest, {
          retry: () => showGame(song, mode),
          menu: showMenu,
        })
      })
    }),
  )
}

function showMicCheck(): void {
  show(() => mountMicCheck(root, showMenu))
}

function showEditor(song?: Song): void {
  show(() =>
    mountEditor(root, song ?? newSong(), {
      tryIt: (s) => showGame(s, loadMode()),
      back: showMenu,
    }),
  )
}

showMenu()
