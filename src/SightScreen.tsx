import { useEffect, useRef, useState } from 'react'
import { SequenceStaff } from './Staff'
import { makeSightSequence, SIGHT_LINE_LENGTH } from './notes'
import type { SightSequence } from './notes'
import { autoCorrelate, midiToFreq, midiLabel } from './pitch'
import { NoteMatcher, toPitchFrame } from './matcher'
import type { PitchFrame } from './matcher'
import { saveRound } from './history'
import { bestKey, loadBest, formatSeconds, starsFor } from './gameConfig'
import type { BestResult } from './gameConfig'
import type { GameState } from './useGame'
import { SoundToggle } from './SoundToggle'

const WRONG_FLASH_MS = 450

interface NoteResult {
  timeMs: number
  wrongCount: number
}

export function SightScreen({ game }: { game: GameState }) {
  const { mode, level } = game
  const [seq, setSeq] = useState<SightSequence>(() => makeSightSequence(mode, level))
  const [cursor, setCursor] = useState(0)
  const [results, setResults] = useState<NoteResult[]>([])
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [heard, setHeard] = useState<{ midi: number; cents: number } | null>(null)
  const [wrongFlash, setWrongFlash] = useState(false)
  const [best, setBest] = useState<BestResult | null>(null)

  const done = cursor >= seq.notes.length

  // Test hook (stripped from production builds): expose the line's target
  // pitches so e2e tests can play the correct notes via __mockPitch.
  if (import.meta.env.DEV) {
    ;(window as unknown as { __sightMidis?: number[] }).__sightMidis = seq.midis
  }

  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const matcherRef = useRef(new NoteMatcher())
  const wrongTimerRef = useRef(0)
  const noteStartRef = useRef(0)
  const wrongCountRef = useRef(0)
  // Refs mirror state the mic loop needs, so the rAF callback never goes stale
  const seqRef = useRef(seq)
  seqRef.current = seq
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor

  function newLine() {
    const next = makeSightSequence(mode, level)
    setSeq(next)
    setCursor(0)
    setResults([])
    setWrongFlash(false)
    setBest(null)
    wrongCountRef.current = 0
    matcherRef.current.reset()
    matcherRef.current.setTarget(next.midis[0])
    noteStartRef.current = performance.now()
  }

  function finishLine(finalResults: NoteResult[]) {
    matcherRef.current.setTarget(null)
    saveRound({
      date: new Date().toISOString(),
      gameType: 'sight',
      level,
      mode,
      extended: false,
      answers: finalResults.map((r, i) => ({
        position: seqRef.current.notes[i].staffPosition,
        clef: seqRef.current.clef,
        correct: r.wrongCount === 0,
        timeMs: r.timeMs,
      })),
    })
    const score = finalResults.filter((r) => r.wrongCount === 0).length
    const avgTimeMs = finalResults.reduce((s, r) => s + r.timeMs, 0) / finalResults.length
    const key = bestKey(mode, level, 'sight', false)
    const previous = loadBest(mode, level, 'sight', false)
    const isBetter =
      !previous ||
      score > previous.score ||
      (score === previous.score && avgTimeMs < previous.avgTimeMs)
    if (isBetter) {
      try {
        localStorage.setItem(key, JSON.stringify({ score, avgTimeMs }))
      } catch {
        // best just won't persist
      }
      setBest({ score, avgTimeMs })
    } else {
      setBest(previous)
    }
  }

  function handleEvent(event: { type: 'correct' | 'wrong'; midi: number }) {
    if (event.type === 'wrong') {
      wrongCountRef.current++
      setWrongFlash(true)
      window.clearTimeout(wrongTimerRef.current)
      wrongTimerRef.current = window.setTimeout(() => setWrongFlash(false), WRONG_FLASH_MS)
      return
    }
    const timeMs = performance.now() - noteStartRef.current
    const result = { timeMs, wrongCount: wrongCountRef.current }
    wrongCountRef.current = 0
    noteStartRef.current = performance.now()
    setWrongFlash(false)
    const nextCursor = cursorRef.current + 1
    setCursor(nextCursor)
    matcherRef.current.setTarget(
      nextCursor < seqRef.current.midis.length ? seqRef.current.midis[nextCursor] : null,
    )
    setResults((rs) => {
      const all = [...rs, result]
      if (nextCursor >= seqRef.current.notes.length) finishLine(all)
      return all
    })
  }

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      const ctx = new AudioContext()
      await ctx.resume()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      ctx.createMediaStreamSource(stream).connect(analyser)
      ctxRef.current = ctx
      streamRef.current = stream
      setListening(true)
      matcherRef.current.reset()
      matcherRef.current.setTarget(seqRef.current.midis[cursorRef.current] ?? null)
      noteStartRef.current = performance.now()

      const buf = new Float32Array(analyser.fftSize)
      const tick = () => {
        let frame: PitchFrame | null = null

        // Test hook (stripped from production builds): lets e2e tests drive
        // the matcher with exact pitches instead of real microphone audio.
        const mock = import.meta.env.DEV
          ? (window as unknown as { __mockPitch?: number | null }).__mockPitch
          : undefined
        if (mock !== undefined) {
          frame = mock === null ? null : toPitchFrame(midiToFreq(mock), 1)
        } else {
          analyser.getFloatTimeDomainData(buf)
          let rms = 0
          for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i]
          rms = Math.sqrt(rms / buf.length)
          const hz = autoCorrelate(buf, ctx.sampleRate)
          frame = hz > 0 ? toPitchFrame(hz, rms) : null
        }

        setHeard(frame ? { midi: frame.midi, cents: Math.round(frame.cents) } : null)
        const event = matcherRef.current.process(frame)
        if (event && cursorRef.current < seqRef.current.notes.length) handleEvent(event)
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      setError(
        'Microphone access is needed for sight reading. Check your browser permissions and try again.',
      )
    }
  }

  // Release the microphone and audio context when leaving the screen
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      void ctxRef.current?.close().catch(() => {})
      window.clearTimeout(wrongTimerRef.current)
    },
    [],
  )

  const score = results.filter((r) => r.wrongCount === 0).length
  const totalMs = results.reduce((s, r) => s + r.timeMs, 0)
  const rating = starsFor(score, seq.notes.length)

  return (
    <main className="app playing">
      <SoundToggle soundOn={game.soundOn} onToggle={game.toggleSound} />
      <button
        className="exit-button"
        onClick={game.exitToMenu}
        aria-label="Exit to menu"
        title="Exit to menu"
      >
        🏠
      </button>

      <header className="hud">
        <span>
          🎼 {Math.min(cursor + 1, seq.notes.length)}/{seq.notes.length}
        </span>
        <span>🎯 {score}</span>
        <span>
          {listening ? '🎤' : '🔇'}{' '}
          {heard ? `${midiLabel(heard.midi)} ${heard.cents >= 0 ? '+' : ''}${heard.cents}¢` : '…'}
        </span>
      </header>

      <div className="staff-wrap sight-wrap">
        <div className="staff-card sequence-card">
          <SequenceStaff
            clef={seq.clef}
            keySignature={seq.key}
            notes={seq.notes}
            cursor={cursor}
            wrong={wrongFlash}
          />
        </div>
      </div>

      <p className="key-hint">
        {seq.key ? `Key: ${seq.key.name} · ` : ''}
        Play each note on your instrument — the cursor moves when you hit it!
      </p>

      {!listening && !done && (
        <>
          <button className="primary mic-start" onClick={start}>
            🎤 Start listening
          </button>
          {error && <p className="mic-error">{error}</p>}
        </>
      )}

      {done && (
        <div className="sight-done">
          <div className="stars">{rating.stars}</div>
          <p className="subtitle">{rating.message}</p>
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-value">
                {score}/{seq.notes.length}
              </span>
              <span className="stat-label">First try</span>
            </div>
            <div className="stat">
              <span className="stat-value">{formatSeconds(totalMs)}</span>
              <span className="stat-label">Total time</span>
            </div>
          </div>
          {best && (
            <p className="best-line">
              Best for this mode: {best.score}/{SIGHT_LINE_LENGTH} · avg{' '}
              {formatSeconds(best.avgTimeMs)}
            </p>
          )}
          <div className="summary-actions">
            <button className="primary" onClick={newLine}>
              New line 🎶
            </button>
            <button onClick={game.exitToMenu}>Menu</button>
          </div>
        </div>
      )}
    </main>
  )
}
