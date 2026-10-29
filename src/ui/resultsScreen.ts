import type { Judge, LossReason } from '../game/judge'
import type { Results } from '../game/scoring'
import type { Mode } from '../game/settings'
import type { Song } from '../songs/song'

const LOSS_TEXT: Record<LossReason, string> = {
  'wrong-note': 'Wrong note',
  'too-early': 'Too early',
  'too-late': 'Too late',
  'released-early': 'Let go too early',
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag)
  e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

/** Renders the results of one play into `root`. */
export function mountResults(
  root: HTMLElement,
  song: Song,
  mode: Mode,
  results: Results,
  loss: Judge['loss'],
  isNewBest: boolean,
  actions: { retry(): void; menu(): void },
): void {
  const box = el('div', 'results')
  box.append(el('h2', 'results-title', song.name))
  box.append(el('p', 'results-mode', mode === 'keyboard' ? 'Keyboard' : 'Recorder'))
  box.append(el('p', 'results-outcome', results.won ? 'Song complete!' : 'Game over'))
  if (loss) {
    box.append(el('p', 'results-loss', LOSS_TEXT[loss.reason]))
    box.append(el('p', 'results-progress', `Progress: ${Math.round(results.progress)}%`))
  }
  box.append(el('p', 'results-score', `Score: ${results.score}`))
  if (isNewBest) box.append(el('p', 'results-best', 'New best!'))

  const counts = el('ul', 'results-counts')
  const rows: [string, number][] = [
    ['Perfect', results.counts.perfect],
    ['Great', results.counts.great],
    ['Good', results.counts.good],
  ]
  for (const [label, n] of rows) counts.append(el('li', 'results-count', `${label}: ${n}`))
  box.append(counts)
  box.append(el('p', 'results-accuracy', `Accuracy: ${results.accuracy.toFixed(1)}%`))

  const buttons = el('div', 'results-actions')
  const retry = el('button', 'results-retry', 'Retry') as HTMLButtonElement
  const menu = el('button', 'results-menu', 'Menu') as HTMLButtonElement
  retry.type = 'button'
  menu.type = 'button'
  retry.addEventListener('click', () => actions.retry())
  menu.addEventListener('click', () => actions.menu())
  buttons.append(retry, menu)
  box.append(buttons)

  root.replaceChildren(box)
}
