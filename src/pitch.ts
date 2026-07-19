// Autocorrelation-based pitch detection (ACF2+ with parabolic interpolation),
// ported from pinardy/purrfect-pitch (itself adapted from Chris Wilson's
// PitchDetect).
export function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length

  let rms = 0
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / SIZE)
  if (rms < 0.005) return -1 // too quiet to call it a note

  // Trim leading/trailing low-amplitude samples to sharpen the correlation
  let r1 = 0
  let r2 = SIZE - 1
  const threshold = 0.2
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < threshold) {
      r1 = i
      break
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < threshold) {
      r2 = SIZE - i
      break
    }
  }

  const trimmed = buf.slice(r1, r2)
  const N = trimmed.length
  if (N < 8) return -1

  const c = new Float32Array(N)
  for (let lag = 0; lag < N; lag++) {
    let sum = 0
    for (let i = 0; i < N - lag; i++) sum += trimmed[i] * trimmed[i + lag]
    c[lag] = sum
  }

  // Skip the initial peak at lag 0, then find the global maximum
  let d = 0
  while (d < N - 1 && c[d] > c[d + 1]) d++
  let maxVal = -1
  let maxPos = -1
  for (let i = d; i < N; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i]
      maxPos = i
    }
  }
  if (maxPos <= 0 || c[0] <= 0) return -1

  // Confidence gate: for a genuinely periodic signal the ACF peak approaches
  // the zero-lag energy. Attack transients and noise score much lower and
  // would otherwise produce spurious note jumps.
  if (maxVal / c[0] < 0.85) return -1

  let period = maxPos
  const x1 = c[maxPos - 1]
  const x2 = c[maxPos]
  const x3 = c[maxPos + 1] ?? x2
  const a = (x1 + x3 - 2 * x2) / 2
  const b = (x3 - x1) / 2
  if (a) period = maxPos - b / (2 * a)

  const freq = sampleRate / period
  // Reject results outside a musically useful range
  if (freq < 27 || freq > 4500) return -1
  return freq
}

export function freqToMidiFloat(hz: number, a4 = 440): number {
  return 12 * Math.log2(hz / a4) + 69
}

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12)
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

/** Display name for a MIDI number, e.g. 61 -> "C♯4" (sharp spelling) */
export function midiLabel(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}
