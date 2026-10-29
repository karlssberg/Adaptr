import type { Fingering, Hole } from '../music/fingerings'

export interface DiagramColors {
  ink: string
  paper: string
}

/** Height in px of a diagram drawn with dot size `d`: thumb, holes 1–3, a gap, holes 4–7. */
export function diagramHeight(d: number): number {
  return d * 9.6
}

/**
 * Draws a recorder fingering top-down, centred on `cx`: the thumb hole (offset left, it is on
 * the back), then holes 1–7 with a gap between the hands. Filled = cover, empty = open,
 * half-filled = half-cover (pinch the thumb / cover the big hole only).
 */
export function drawFingering(
  ctx: CanvasRenderingContext2D,
  f: Fingering,
  cx: number,
  top: number,
  d: number,
  colors: DiagramColors,
): void {
  const r = d * 0.42
  const step = d * 1.1
  const dot = (x: number, y: number, hole: Hole) => {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = colors.paper
    ctx.fill()
    if (hole !== 'open') {
      ctx.beginPath()
      if (hole === 'closed') ctx.arc(x, y, r, 0, Math.PI * 2)
      else {
        ctx.moveTo(x, y)
        ctx.arc(x, y, r, Math.PI / 2, (Math.PI * 3) / 2)
        ctx.closePath()
      }
      ctx.fillStyle = colors.ink
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.lineWidth = Math.max(1, d * 0.12)
    ctx.strokeStyle = colors.ink
    ctx.stroke()
  }
  let y = top + r + 1
  dot(cx - d * 0.9, y, f.thumb)
  y += step
  f.holes.forEach((hole, i) => {
    if (i === 3) y += d * 0.5
    dot(cx, y, hole)
    y += step
  })
}
