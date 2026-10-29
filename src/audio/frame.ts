import type { PitchDetector } from 'pitchy'
import type { Frame } from './noteTracker'

/**
 * One analysis frame from a `size`-sample window. Pitch uses the whole window; rms uses only
 * the newest `hop` samples so a short tongue gap shows up as a dip. `tCentreMs` is the
 * window centre time. Shared by the offline `analyse` and the live mic.
 * Known offset (accepted): rms describes the newest hop, ~(size - hop) / 2 samples (~17 ms at
 * 44.1 kHz) later than `tCentreMs`, so dips are timestamped slightly early relative to the audio.
 */
export function computeFrame(
  window: Float32Array,
  sampleRate: number,
  hop: number,
  detector: PitchDetector<Float32Array>,
  tCentreMs: number,
): Frame {
  const [pitchHz, clarity] = detector.findPitch(window, sampleRate)
  let sum = 0
  for (let i = window.length - hop; i < window.length; i++) sum += window[i] * window[i]
  return { t: tCentreMs, pitchHz, clarity, rms: Math.sqrt(sum / hop) }
}
