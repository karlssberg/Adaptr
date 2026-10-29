import { afterEach, describe, expect, it, vi } from 'vitest'
import { startMic } from '../src/audio/mic'

const reject = (name: string) => () => Promise.reject(new DOMException('x', name))

describe('startMic errors', () => {
  it('maps NotAllowedError to a blocked message', async () => {
    const r = await startMic(() => {}, { getUserMedia: reject('NotAllowedError') })
    expect(r).toEqual({ ok: false, message: 'Microphone access was blocked. Allow it in the browser and try again.' })
  })
  it('maps NotFoundError to no microphone', async () => {
    const r = await startMic(() => {}, { getUserMedia: reject('NotFoundError') })
    expect(r).toEqual({ ok: false, message: 'No microphone found.' })
  })
  it('treats missing getUserMedia as no microphone', async () => {
    const r = await startMic(() => {}, { getUserMedia: undefined })
    expect(r).toEqual({ ok: false, message: 'No microphone found.' })
  })
  it('hides technical details of unknown errors', async () => {
    const r = await startMic(() => {}, { getUserMedia: () => Promise.reject(new Error('boom')) })
    expect(r).toEqual({ ok: false, message: "Couldn't start the microphone." })
  })
})

describe('startMic with a hanging AudioContext.resume()', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('gives up after 2 s with a friendly message and releases the stream and context', async () => {
    vi.useFakeTimers()
    const stopTrack = vi.fn()
    const close = vi.fn(() => Promise.resolve())
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream
    class HangingContext {
      state = 'suspended'
      resume = () => new Promise<void>(() => {})
      close = close
    }
    const pending = startMic(() => {}, {
      getUserMedia: () => Promise.resolve(stream),
      AudioContextCtor: HangingContext as unknown as typeof AudioContext,
    })
    let settled = false
    void pending.then(() => (settled = true))
    await vi.advanceTimersByTimeAsync(1999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toEqual({ ok: false, message: "Couldn't start the microphone." })
    expect(stopTrack).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })
})
