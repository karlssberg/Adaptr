import type { Mode } from '../game/settings'
import type { Song } from '../songs/song'

const MODE_KEY = 'recorder-tiles:mode'

export function loadMode(): Mode {
  try {
    return window.localStorage.getItem(MODE_KEY) === 'recorder' ? 'recorder' : 'keyboard'
  } catch {
    return 'keyboard'
  }
}

export function saveMode(m: Mode): void {
  try {
    window.localStorage.setItem(MODE_KEY, m)
  } catch {
    // ignore: the mode simply isn't remembered
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className, text)
  b.type = 'button'
  b.addEventListener('click', onClick)
  return b
}

/**
 * Renders the song list, mode toggle and navigation buttons into `root`. The caller owns
 * the selected mode (`initialMode`, updated through `actions.setMode`) so it survives even
 * when localStorage is unavailable.
 */
export function mountMenu(
  root: HTMLElement,
  songs: Song[],
  best: (id: string, m: Mode) => number | null,
  initialMode: Mode,
  actions: {
    play(song: Song, mode: Mode): void
    micCheck(): void
    edit(song?: Song): void
    setMode(m: Mode): void
  },
): void {
  let mode = initialMode
  const box = el('div', 'menu')
  box.append(el('h1', 'menu-title', 'Recorder Tiles'))

  const modes = el('div', 'mode-toggle')
  const options: [Mode, string][] = [
    ['keyboard', 'Keyboard'],
    ['recorder', 'Recorder'],
  ]
  for (const [value, label] of options) {
    const wrap = el('label', 'mode-option')
    const input = el('input', 'mode-radio')
    input.type = 'radio'
    input.name = 'mode'
    input.value = value
    input.checked = mode === value
    input.addEventListener('change', () => {
      if (!input.checked) return
      mode = value
      actions.setMode(value)
    })
    wrap.append(input, document.createTextNode(label))
    modes.append(wrap)
  }
  box.append(modes)

  const fmt = (n: number | null) => (n === null ? '—' : String(n))
  const list = el('ul', 'song-list')
  for (const song of songs) {
    const row = el('li', 'song-row')
    const info = el('div', 'song-info')
    info.append(el('div', 'song-name', song.name))
    info.append(el('div', 'song-best', `Keyboard best: ${fmt(best(song.id, 'keyboard'))}`))
    info.append(el('div', 'song-best', `Recorder best: ${fmt(best(song.id, 'recorder'))}`))
    row.append(info)
    const btns = el('div', 'song-actions')
    btns.append(button('btn btn-primary', 'Play', () => actions.play(song, mode)))
    if (!song.builtIn) btns.append(button('btn', 'Edit', () => actions.edit(song)))
    row.append(btns)
    list.append(row)
  }
  box.append(list)

  const footer = el('div', 'menu-footer')
  footer.append(button('btn', 'Mic check', () => actions.micCheck()))
  footer.append(button('btn', 'New song', () => actions.edit()))
  box.append(footer)

  root.replaceChildren(box)
}
