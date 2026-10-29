import { startMic } from '../audio/mic'
import { NoteTracker } from '../audio/noteTracker'
import type { Judge } from '../game/judge'
import { computeResults, rate, type Results } from '../game/scoring'
import { FALL_MS, GameSession, LEAD_IN_MS } from '../game/session'
import type { Mode } from '../game/settings'
import { createKeyHandler, keysForLanes } from '../input/keyboard'
import { laneLabels, laneNotes, type Song } from '../songs/song'
import { fingeringFor } from '../music/fingerings'
import { diagramHeight, drawFingering } from './fingeringDiagram'

const HIT_LINE = 0.78
const END_LINGER_MS = 600
const LABEL_TOP = 6
const MAX_DOT = 14

const COLORS = {
  bg: '#14161c',
  laneAlt: '#1b1e26',
  laneLit: '#2c3e5c',
  tile: '#e8ecf4',
  tileHit: '#4a5468',
  lost: '#e5484d',
  line: '#7aa2ff',
  text: '#c9d1e0',
}

/**
 * Mounts the falling-tiles game in `root`. Calls `onEnd` once: with results (and the loss)
 * ~600 ms after the song is won or lost, or with null if abandoned (Escape, the Back button
 * while the mic starts or after it fails, or the tab is hidden).
 * Returns a cleanup function (idempotent).
 */
export function mountGame(
  root: HTMLElement,
  song: Song,
  mode: Mode,
  onEnd: (r: Results | null, loss?: Judge['loss']) => void,
): () => void {
  const lanes = laneNotes(song)
  const labels = laneLabels(lanes)
  const keys = mode === 'keyboard' ? keysForLanes(lanes.length).map((k) => k.toUpperCase()) : null
  const fingerings = lanes.map(fingeringFor)

  root.replaceChildren()
  const canvas = document.createElement('canvas')
  canvas.className = 'game-canvas'
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  const ctx = canvas.getContext('2d')!

  let session: GameSession | null = null
  let raf = 0
  let disposed = false
  let ended = false
  let endAt: number | null = null
  let stopMic: (() => void) | null = null
  let detachInput: (() => void) | null = null
  let width = 0
  let height = 0

  const resize = () => {
    const dpr = window.devicePixelRatio || 1
    width = root.clientWidth
    height = root.clientHeight
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  const observer = new ResizeObserver(resize)

  const stopInput = () => {
    detachInput?.()
    detachInput = null
    stopMic?.()
    stopMic = null
  }

  const finish = (r: Results | null, loss?: Judge['loss']) => {
    if (ended) return
    ended = true
    cleanup()
    onEnd(r, loss)
  }

  /** Leave now: results if the song already ended (lingering), otherwise abandon. */
  const quit = () => {
    if (session && endAt !== null) return finish(session.results(), session.judge.loss)
    session?.abandon()
    finish(null)
  }

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') quit()
  }

  // Escape is never a lane key, so it is safe to use in keyboard mode too.
  const onEscape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    quit()
  }

  const frame = () => {
    raf = 0
    if (disposed || !session) return
    const now = performance.now()
    session.tick(now)
    const status = session.status
    if (status === 'won' || status === 'lost') {
      if (endAt === null) {
        endAt = now
        stopInput()
      } else if (now - endAt >= END_LINGER_MS) {
        draw(session, now)
        return finish(session.results(), session.judge.loss)
      }
    }
    draw(session, now)
    raf = requestAnimationFrame(frame)
  }

  const draw = (s: GameSession, now: number) => {
    const n = lanes.length
    const laneW = width / n
    const hitY = height * HIT_LINE
    const speed = hitY / FALL_MS
    const loss = s.judge.loss
    const flash = loss !== undefined && Math.floor(now / 100) % 2 === 0
    const lostLane = loss ? lanes.indexOf(s.tiles[loss.index].note) : -1

    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, width, height)
    for (let i = 0; i < n; i++) {
      if (i === lostLane && flash) ctx.fillStyle = COLORS.lost
      else if (s.sounding === lanes[i] && s.status === 'playing') ctx.fillStyle = COLORS.laneLit
      else ctx.fillStyle = i % 2 ? COLORS.laneAlt : COLORS.bg
      ctx.fillRect(i * laneW, 0, laneW, height)
    }

    const hitCount = s.judge.hits.length
    for (const t of s.tiles) {
      const bottom = hitY - (t.startMs - now) * speed
      const top = hitY - (t.endMs - now) * speed
      if (bottom < 0 || top > height) continue
      const lane = lanes.indexOf(t.note)
      if (loss && t.index === loss.index) ctx.fillStyle = COLORS.lost
      else ctx.fillStyle = t.index < hitCount ? COLORS.tileHit : COLORS.tile
      ctx.fillRect(lane * laneW + 3, top + 1, laneW - 6, Math.max(2, bottom - top - 2))
    }

    // Repaint the area under the hit line so held tiles don't cover the labels.
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i === lostLane && flash ? COLORS.lost : i % 2 ? COLORS.laneAlt : COLORS.bg
      ctx.fillRect(i * laneW, hitY, laneW, height - hitY)
    }
    ctx.fillStyle = COLORS.line
    ctx.fillRect(0, hitY - 1, width, 3)

    // Below the hit line each lane shows its note name, its key (keyboard mode) and how to
    // finger it, scaled down to fit narrow lanes and short windows.
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const textH = keys ? 34 : 20
    const diagramTop = hitY + LABEL_TOP + textH + 4
    const dot = Math.min(MAX_DOT, laneW / 3.2, (height - diagramTop - 4) / diagramHeight(1))
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * laneW
      ctx.fillStyle = COLORS.text
      ctx.font = 'bold 16px system-ui, sans-serif'
      ctx.fillText(labels[i], x, hitY + LABEL_TOP)
      if (keys) {
        ctx.font = '12px system-ui, sans-serif'
        ctx.fillText(keys[i], x, hitY + LABEL_TOP + 19)
      }
      const fingering = fingerings[i]
      if (fingering && dot >= 3) {
        drawFingering(ctx, fingering, x + dot * 0.45, diagramTop, dot, { ink: COLORS.text, paper: COLORS.bg })
      }
    }
    ctx.textBaseline = 'middle'

    const firstAt = s.tiles[0]?.startMs ?? now
    if (now < firstAt && firstAt - now <= LEAD_IN_MS) {
      ctx.fillStyle = COLORS.text
      ctx.font = 'bold 22px system-ui, sans-serif'
      ctx.fillText(`Get ready ${Math.ceil((firstAt - now) / 1000)}`, width / 2, height * 0.35)
    }

    const live = computeResults(s.tiles, s.judge.hits, false, s.settings)
    let combo = 0
    for (let i = s.judge.hits.length - 1; i >= 0; i--) {
      if (rate(s.judge.hits[i].offsetMs, s.settings) !== 'perfect') break
      combo++
    }
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillStyle = COLORS.text
    ctx.font = 'bold 18px system-ui, sans-serif'
    ctx.fillText(String(live.score), width - 10, 10)
    if (combo > 1) {
      ctx.font = '14px system-ui, sans-serif'
      ctx.fillText(`Combo ${combo}`, width - 10, 32)
    }
  }

  const begin = () => {
    session = new GameSession(song, mode, performance.now())
    raf = requestAnimationFrame(frame)
  }

  function cleanup() {
    if (disposed) return
    disposed = true
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    stopInput()
    observer.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('keydown', onEscape)
  }

  root.append(canvas)
  resize()
  observer.observe(root)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('keydown', onEscape)

  if (mode === 'keyboard') {
    begin()
    const s = session!
    const handler = createKeyHandler(lanes, s)
    const onBlur = () => s.noteOff(performance.now())
    window.addEventListener('keydown', handler.keydown)
    window.addEventListener('keyup', handler.keyup)
    window.addEventListener('blur', onBlur)
    detachInput = () => {
      window.removeEventListener('keydown', handler.keydown)
      window.removeEventListener('keyup', handler.keyup)
      window.removeEventListener('blur', onBlur)
    }
  } else {
    const status = document.createElement('p')
    status.className = 'game-status'
    status.textContent = 'Starting microphone…'
    // Back abandons while the mic starts (a later-resolving mic is stopped below) and
    // stays as the way out if it fails.
    const back = document.createElement('button')
    back.type = 'button'
    back.className = 'btn game-back'
    back.textContent = 'Back'
    back.addEventListener('click', () => quit())
    const overlay = document.createElement('div')
    overlay.className = 'game-overlay'
    overlay.append(status, back)
    root.append(overlay)
    let tracker: NoteTracker | null = null
    void startMic((f) => tracker?.push(f)).then((mic) => {
      if (!mic.ok) {
        if (disposed) return
        canvas.remove()
        status.className = 'game-error'
        status.textContent = mic.message
        return
      }
      if (disposed) return mic.stop()
      overlay.remove()
      stopMic = mic.stop
      begin()
      tracker = new NoteTracker(session!)
    })
  }

  return cleanup
}
