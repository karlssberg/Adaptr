import { playSong } from '../audio/player'
import { STEP_BEATS, extendTo, toggleCell } from '../editor/editorModel'
import { RECORDER_NOTES } from '../music/notes'
import { validateSong, type Song } from '../songs/song'
import { deleteUserSong, loadUserSongs, safeLocalStorage, saveUserSong } from '../songs/storage'

const MIN_ROWS = 32
const EXTRA_ROWS = 16

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

/** Renders the grid editor into `root`; returns a cleanup that stops any preview. */
export function mountEditor(
  root: HTMLElement,
  initial: Song,
  actions: { tryIt(song: Song): void; back(): void },
): () => void {
  const song: Song = { ...initial, notes: initial.notes.map((n) => ({ ...n })) }
  const store = safeLocalStorage()
  const isSaved = () => loadUserSongs(store).some((s) => s.id === song.id)

  const box = el('div', 'editor')

  // --- toolbar ---
  const bar = el('div', 'editor-bar')
  const nameInput = el('input', 'editor-name')
  nameInput.type = 'text'
  nameInput.value = song.name
  nameInput.setAttribute('aria-label', 'Song name')
  const bpmInput = el('input', 'editor-bpm')
  bpmInput.type = 'number'
  bpmInput.min = '30'
  bpmInput.max = '240'
  bpmInput.value = String(song.bpm)
  bpmInput.setAttribute('aria-label', 'BPM')
  const bpmLabel = el('label', 'editor-bpm-label', 'BPM ')
  bpmLabel.append(bpmInput)
  const status = el('span', 'editor-status')
  bar.append(nameInput, bpmLabel)

  const backBtn = button('btn', 'Back', () => actions.back())
  const previewBtn = button('btn', 'Preview', () => void togglePreview())
  const saveBtn = button('btn btn-primary', 'Save', () => save())
  const tryBtn = button('btn', 'Try it', () => {
    stopPreview()
    if (validateSong(song)) actions.tryIt(song)
  })
  const deleteBtn = button('btn', 'Delete', () => {
    if (!confirm(`Delete "${song.name}"?`)) return
    if (!deleteUserSong(store, song.id)) {
      status.textContent = "Couldn't delete"
      return
    }
    actions.back()
  })
  const buttons = el('div', 'editor-actions')
  buttons.append(backBtn, previewBtn, saveBtn, tryBtn, deleteBtn, status)

  // --- grid ---
  const scroll = el('div', 'editor-scroll')
  const grid = el('div', 'editor-grid')
  grid.style.gridTemplateColumns = `repeat(${RECORDER_NOTES.length}, var(--cell-w))`
  scroll.append(grid)

  box.append(bar, buttons, scroll)
  root.replaceChildren(box)

  let cells: HTMLElement[][] = []
  let rowCount = 0

  const neededRows = () => {
    const lastEnd = song.notes.reduce((m, n) => Math.max(m, n.startBeat + n.beats), 0)
    return Math.max(MIN_ROWS, Math.ceil(lastEnd / STEP_BEATS) + EXTRA_ROWS)
  }

  function buildGrid(): void {
    rowCount = neededRows()
    grid.replaceChildren()
    RECORDER_NOTES.forEach((n) => grid.append(el('div', 'editor-head', n)))
    cells = []
    for (let r = 0; r < rowCount; r++) {
      const rowCells: HTMLElement[] = []
      for (let c = 0; c < RECORDER_NOTES.length; c++) {
        const cell = el('div', r % 2 === 0 ? 'editor-cell beat' : 'editor-cell')
        cell.dataset.row = String(r)
        cell.dataset.col = String(c)
        rowCells.push(cell)
        grid.append(cell)
      }
      cells.push(rowCells)
    }
  }

  function render(): void {
    if (neededRows() !== rowCount) buildGrid()
    for (const rowCells of cells) for (const c of rowCells) c.classList.remove('on', 'start')
    for (const n of song.notes) {
      const col = RECORDER_NOTES.indexOf(n.note)
      const r0 = Math.round(n.startBeat / STEP_BEATS)
      const r1 = Math.max(r0 + 1, Math.round((n.startBeat + n.beats) / STEP_BEATS))
      for (let r = r0; r < r1 && r < rowCount; r++) {
        cells[r][col].classList.add('on')
        if (r === r0) cells[r][col].classList.add('start')
      }
    }
    const ok = validateSong(song)
    saveBtn.disabled = !ok
    tryBtn.disabled = !ok
    previewBtn.disabled = !ok && !preview
    deleteBtn.hidden = !isSaved()
  }

  // --- pointer editing ---
  // Decision rule for a press on a note's *start* cell: it is ambiguous between
  // "remove this note" (click) and "stretch it" (drag down). We decide on release:
  // if the pointer entered a different row before pointerup it was a drag (the note
  // was already extended live), otherwise it was a click and the note is removed.
  // A press on any other cell acts immediately via toggleCell.
  let drag: { note: (typeof song.notes)[number]; startRow: number; col: number; moved: boolean } | null = null

  const cellOf = (t: EventTarget | null): { row: number; col: number } | null => {
    if (!(t instanceof HTMLElement) || !t.classList.contains('editor-cell')) return null
    return { row: Number(t.dataset.row), col: Number(t.dataset.col) }
  }

  const changed = () => {
    status.textContent = ''
    render()
  }

  grid.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    const pos = cellOf(e.target)
    if (!pos) return
    e.preventDefault()
    const note = RECORDER_NOTES[pos.col]
    const startsHere = song.notes.find(
      (n) => n.note === note && Math.round(n.startBeat / STEP_BEATS) === pos.row,
    )
    if (startsHere) {
      drag = { note: startsHere, startRow: pos.row, col: pos.col, moved: false }
    } else {
      song.notes = toggleCell(song.notes, note, pos.row)
      changed()
    }
  })

  const onMove = (e: PointerEvent) => {
    if (!drag) return
    const pos = cellOf(document.elementFromPoint(e.clientX, e.clientY))
    if (!pos || pos.row === drag.startRow && !drag.moved) return
    if (pos.row !== drag.startRow) drag.moved = true
    const index = song.notes.indexOf(drag.note)
    const next = extendTo(song.notes, index, Math.max(pos.row, drag.startRow))
    if (next !== song.notes) {
      song.notes = next
      drag.note = next[index]
      changed()
    }
  }
  const onUp = () => {
    if (!drag) return
    const d = drag
    drag = null
    if (!d.moved) {
      song.notes = toggleCell(song.notes, RECORDER_NOTES[d.col], d.startRow)
      changed()
    }
  }
  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
  const onCancel = () => {
    drag = null
  }
  document.addEventListener('pointercancel', onCancel)

  // --- inputs ---
  nameInput.addEventListener('input', () => {
    song.name = nameInput.value
    status.textContent = ''
  })
  bpmInput.addEventListener('input', () => {
    song.bpm = bpmInput.valueAsNumber
    changed()
  })

  // --- preview ---
  let ctx: AudioContext | null = null
  let preview: { stop(): void } | null = null
  let previewTimer: number | undefined

  function stopPreview(): void {
    clearTimeout(previewTimer)
    preview?.stop()
    preview = null
    previewBtn.textContent = 'Preview'
    if (box.isConnected) previewBtn.disabled = !validateSong(song)
  }

  let starting = false
  let disposed = false

  async function togglePreview(): Promise<void> {
    if (starting) return
    if (preview) {
      stopPreview()
      return
    }
    if (!validateSong(song)) return
    starting = true
    try {
      // Created lazily inside the click handler so the browser allows audio.
      ctx ??= new AudioContext()
      await ctx.resume()
    } catch {
      starting = false
      return
    }
    starting = false
    if (disposed || !ctx) return
    preview = playSong(song, ctx)
    previewBtn.textContent = 'Stop'
    const last = song.notes.reduce((m, n) => Math.max(m, n.startBeat + n.beats), 0)
    previewTimer = window.setTimeout(stopPreview, (last * 60000) / song.bpm + 400)
  }

  function save(): void {
    if (!validateSong(song)) return
    status.textContent = saveUserSong(store, song) ? 'Saved' : "Couldn't save"
    deleteBtn.hidden = !isSaved()
  }

  buildGrid()
  render()

  return () => {
    disposed = true
    stopPreview()
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    document.removeEventListener('pointercancel', onCancel)
    void ctx?.close().catch(() => {})
    ctx = null
  }
}
