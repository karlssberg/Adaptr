import './style.css'
import { mountGame } from './ui/gameScreen'
import { mountMenu } from './ui/menuScreen'
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

// Placeholder: replaced by the song editor in Task 11.
function showEditor(song?: Song): void {
  show(() => {
    const box = document.createElement('div')
    box.className = 'menu'
    const p = document.createElement('p')
    p.textContent = song ? `Editor for "${song.name}" is coming soon.` : 'Song editor is coming soon.'
    const back = document.createElement('button')
    back.type = 'button'
    back.className = 'btn'
    back.textContent = 'Back'
    back.addEventListener('click', showMenu)
    box.append(p, back)
    root.append(box)
  })
}

showMenu()
