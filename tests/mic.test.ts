import { describe, expect, it } from 'vitest'
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
