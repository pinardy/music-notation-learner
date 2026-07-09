// Synthesized note playback via the Web Audio API — no audio assets needed.
// The context is created lazily on first use, which happens inside a click
// handler, so the browser's autoplay policy is satisfied.

let ctx: AudioContext | null = null

export function playNote(midi: number, durationS = 1.1) {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()

    const freq = 440 * 2 ** ((midi - 69) / 12)
    const t = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.25, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, t + durationS)
    gain.connect(ctx.destination)

    // Fundamental plus a quiet upper octave for a warmer, chime-like tone
    for (const [mult, level, type] of [
      [1, 1, 'triangle'],
      [2, 0.25, 'sine'],
    ] as const) {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq * mult
      const partial = ctx.createGain()
      partial.gain.value = level
      osc.connect(partial).connect(gain)
      osc.start(t)
      osc.stop(t + durationS + 0.1)
    }
  } catch {
    // Audio unavailable (unsupported browser) — the game works fine silently
  }
}
