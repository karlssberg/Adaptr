import { startMic } from '../audio/mic'
import { TRACKER } from '../audio/trackerSettings'
import { frequencyToNote } from '../music/notes'

/** Live note detector for checking the microphone. Returns an idempotent cleanup. */
export function mountMicCheck(root: HTMLElement, back: () => void): () => void {
  const box = document.createElement('div')
  box.className = 'mic-check'
  const title = document.createElement('h2')
  title.textContent = 'Mic check'
  const label = document.createElement('div')
  label.className = 'mic-note'
  label.textContent = '—'
  const bar = document.createElement('div')
  bar.className = 'mic-bar'
  const fill = document.createElement('div')
  fill.className = 'mic-bar-fill'
  bar.append(fill)
  const msg = document.createElement('p')
  msg.className = 'mic-message'
  msg.textContent = 'Play a note on your recorder.'
  const backBtn = document.createElement('button')
  backBtn.type = 'button'
  backBtn.className = 'btn'
  backBtn.textContent = 'Back'
  backBtn.addEventListener('click', back)
  box.append(title, label, bar, msg, backBtn)
  root.replaceChildren(box)

  let disposed = false
  let stop: (() => void) | null = null
  void startMic((f) => {
    fill.style.width = `${Math.min(100, Math.round(f.rms * 400))}%`
    const valid = f.clarity >= TRACKER.minClarity && f.rms >= TRACKER.minRms
    const n = valid ? frequencyToNote(f.pitchHz) : null
    label.textContent = n ? n.note : '—'
  }).then((r) => {
    if (r.ok) {
      if (disposed) r.stop()
      else stop = r.stop
    } else if (!disposed) {
      msg.textContent = r.message
    }
  })

  return () => {
    if (disposed) return
    disposed = true
    stop?.()
    stop = null
  }
}
