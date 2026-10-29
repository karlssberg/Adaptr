import { PitchDetector } from 'pitchy'
import { computeFrame } from './frame'
import type { Frame } from './noteTracker'

export type MicResult = { ok: true; stop(): void } | { ok: false; message: string }

export interface MicDeps {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  AudioContextCtor?: typeof AudioContext
}

const SIZE = 2048
const HOP = 512

function failure(e: unknown): MicResult {
  const name = e instanceof Error || e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError') {
    return { ok: false, message: 'Microphone access was blocked. Allow it in the browser and try again.' }
  }
  if (name === 'NotFoundError') return { ok: false, message: 'No microphone found.' }
  return { ok: false, message: "Couldn't start the microphone." }
}

export async function startMic(onFrame: (f: Frame) => void, deps: MicDeps = {}): Promise<MicResult> {
  const getUserMedia =
    'getUserMedia' in deps
      ? deps.getUserMedia
      : typeof navigator !== 'undefined' && navigator.mediaDevices
        ? (c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c)
        : undefined
  if (!getUserMedia) return { ok: false, message: 'No microphone found.' }

  let stream: MediaStream | undefined
  let ctx: AudioContext | undefined
  try {
    stream = await getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
    const Ctor = deps.AudioContextCtor ?? AudioContext
    ctx = new Ctor()
    if (ctx.state === 'suspended') await ctx.resume()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = SIZE
    ctx.createMediaStreamSource(stream).connect(analyser)

    const sampleRate = ctx.sampleRate
    const detector = PitchDetector.forFloat32Array(SIZE)
    const buf = new Float32Array(SIZE)
    let raf = 0
    const loop = () => {
      analyser.getFloatTimeDomainData(buf)
      const t = performance.now() - (SIZE / 2 / sampleRate) * 1000
      onFrame(computeFrame(buf, sampleRate, HOP, detector, t))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const s = stream
    const c = ctx
    return {
      ok: true,
      stop() {
        cancelAnimationFrame(raf)
        s.getTracks().forEach((tr) => tr.stop())
        void c.close()
      },
    }
  } catch (e) {
    stream?.getTracks().forEach((tr) => tr.stop())
    void ctx?.close()
    return failure(e)
  }
}
