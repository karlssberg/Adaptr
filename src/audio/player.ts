import { soundingFrequency } from '../music/notes'
import { toTimedNotes, type Song } from '../songs/song'

const ATTACK = 0.02
const RELEASE = 0.04
const LEAD_IN = 0.1
const PEAK = 0.25

/** Previews a song with a triangle-wave synth. Scheduled relative to ctx.currentTime. */
export function playSong(song: Song, ctx: AudioContext): { stop(): void } {
  const t0 = ctx.currentTime + LEAD_IN
  const nodes: { osc: OscillatorNode; gain: GainNode }[] = []
  for (const n of toTimedNotes(song)) {
    const start = t0 + n.startMs / 1000
    const end = t0 + n.endMs / 1000
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = soundingFrequency(n.note)
    const attackEnd = Math.min(start + ATTACK, end)
    const releaseStart = Math.max(attackEnd, end - RELEASE)
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(PEAK, attackEnd)
    gain.gain.setValueAtTime(PEAK, releaseStart)
    gain.gain.linearRampToValueAtTime(0, end)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(end)
    nodes.push({ osc, gain })
  }
  return {
    stop() {
      for (const { osc, gain } of nodes) {
        try {
          osc.stop()
        } catch {
          // already ended
        }
        osc.disconnect()
        gain.disconnect()
      }
    },
  }
}
