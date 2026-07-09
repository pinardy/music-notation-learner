import { useEffect, useRef, useState } from 'react'
import { Staff } from './Staff'
import { makeQuestion } from './notes'
import type { ClefMode, Level, Question } from './notes'
import { playNote } from './audio'
import './App.css'

const ROUND_LENGTH = 10
const FEEDBACK_MS = 900

const LEVELS: { id: Level; label: string; blurb: string }[] = [
  { id: 'easy', label: '🌱 Easy', blurb: 'Natural notes only' },
  { id: 'medium', label: '🌟 Medium', blurb: 'Sharps & flats on the note' },
  { id: 'hard', label: '🚀 Hard', blurb: 'Key signatures' },
]

const PRAISE = ['Great job! 🎉', 'Awesome! ⭐', 'You rock! 🎸', 'Super! ✨', 'Wow! 🌈']
const BURST_EMOJI = ['🎉', '⭐', '🎵', '✨', '🎈', '🌟']

function starsFor(score: number): { stars: string; message: string } {
  if (score >= 9) return { stars: '🌟🌟🌟', message: 'Amazing! You are a note master!' }
  if (score >= 7) return { stars: '🌟🌟', message: 'Great playing! Almost perfect!' }
  if (score >= 4) return { stars: '🌟', message: 'Nice work! Keep practicing!' }
  return { stars: '💪', message: 'Good try! You will get it next time!' }
}

interface AnswerRecord {
  note: string
  clef: string
  key?: string
  answer: string
  correct: boolean
  timeMs: number
}

interface BestResult {
  score: number
  avgTimeMs: number
}

type Screen = 'start' | 'playing' | 'summary'

function bestKey(mode: ClefMode, level: Level) {
  // Easy keeps the original key so pre-levels best scores survive
  return level === 'easy' ? `note-game-best-${mode}` : `note-game-best-${level}-${mode}`
}

function loadBest(mode: ClefMode, level: Level): BestResult | null {
  try {
    const raw = localStorage.getItem(bestKey(mode, level))
    return raw ? (JSON.parse(raw) as BestResult) : null
  } catch {
    return null
  }
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [mode, setMode] = useState<ClefMode>('treble')
  const [level, setLevel] = useState<Level>('easy')
  const [question, setQuestion] = useState<Question | null>(null)
  const [questionNumber, setQuestionNumber] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [best, setBest] = useState<BestResult | null>(null)
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem('note-game-sound') !== 'off'
    } catch {
      return true
    }
  })
  const questionStartRef = useRef(0)
  const timeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timeoutRef.current), [])

  const score = answers.filter((a) => a.correct).length
  const totalTimeMs = answers.reduce((sum, a) => sum + a.timeMs, 0)

  function toggleSound() {
    setSoundOn((on) => {
      try {
        localStorage.setItem('note-game-sound', on ? 'off' : 'on')
      } catch {
        // preference just won't persist
      }
      return !on
    })
  }

  const soundToggle = (
    <button
      className="sound-toggle"
      onClick={toggleSound}
      aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}
      title={soundOn ? 'Sound on' : 'Sound off'}
    >
      {soundOn ? '🔊' : '🔇'}
    </button>
  )

  function startRound(selectedMode: ClefMode) {
    setMode(selectedMode)
    setAnswers([])
    setSelected(null)
    setQuestionNumber(1)
    setQuestion(makeQuestion(selectedMode, level))
    setScreen('playing')
    questionStartRef.current = performance.now()
  }

  function finishRound(finalAnswers: AnswerRecord[]) {
    const finalScore = finalAnswers.filter((a) => a.correct).length
    const avgTimeMs =
      finalAnswers.reduce((sum, a) => sum + a.timeMs, 0) / finalAnswers.length

    const previous = loadBest(mode, level)
    const isBetter =
      !previous ||
      finalScore > previous.score ||
      (finalScore === previous.score && avgTimeMs < previous.avgTimeMs)
    if (isBetter) {
      const result = { score: finalScore, avgTimeMs }
      try {
        localStorage.setItem(bestKey(mode, level), JSON.stringify(result))
      } catch {
        // localStorage unavailable — best score just won't persist
      }
      setBest(result)
    } else {
      setBest(previous)
    }
    setScreen('summary')
  }

  function handleAnswer(label: string) {
    if (!question || selected !== null) return
    const timeMs = performance.now() - questionStartRef.current
    setSelected(label)
    // Let the player hear the note they just read (the correct pitch either way)
    if (soundOn) playNote(question.midi)

    const record: AnswerRecord = {
      note: `${question.answer}${question.note.octave}`,
      clef: question.note.clef,
      key: question.key?.name,
      answer: label,
      correct: label === question.answer,
      timeMs,
    }
    const nextAnswers = [...answers, record]
    setAnswers(nextAnswers)

    timeoutRef.current = window.setTimeout(() => {
      if (nextAnswers.length >= ROUND_LENGTH) {
        finishRound(nextAnswers)
      } else {
        setSelected(null)
        setQuestionNumber((n) => n + 1)
        setQuestion(makeQuestion(mode, level, question.note))
        questionStartRef.current = performance.now()
      }
    }, FEEDBACK_MS)
  }

  if (screen === 'start') {
    return (
      <main className="app">
        {soundToggle}
        <h1>🎵 Note Reading Trainer 🎶</h1>
        <p className="subtitle">
          Can you name the notes? {ROUND_LENGTH} notes per round — be quick and
          score big!
        </p>

        <div className="level-picker" role="radiogroup" aria-label="Difficulty">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              role="radio"
              aria-checked={level === l.id}
              className={`level-button${level === l.id ? ' active' : ''}`}
              onClick={() => setLevel(l.id)}
            >
              <span className="level-label">{l.label}</span>
              <span className="level-blurb">{l.blurb}</span>
            </button>
          ))}
        </div>

        <div className="mode-buttons">
          {(
            [
              ['treble', '🐦 Treble Clef 𝄞'],
              ['bass', '🐻 Bass Clef 𝄢'],
              ['alto', '🦊 Alto Clef 𝄡'],
              ['tenor', '🐸 Tenor Clef 𝄡'],
              ['both', '🎲 All Clefs'],
            ] as [ClefMode, string][]
          ).map(([m, label]) => {
            const b = loadBest(m, level)
            return (
              <button key={m} className="mode-button" onClick={() => startRound(m)}>
                <span className="mode-label">{label}</span>
                <span className="mode-best">
                  {b
                    ? `Best: ${b.score}/${ROUND_LENGTH} · avg ${formatSeconds(b.avgTimeMs)}`
                    : 'No games yet'}
                </span>
              </button>
            )
          })}
        </div>
      </main>
    )
  }

  if (screen === 'summary') {
    const avgTimeMs = totalTimeMs / answers.length
    const hasKeys = answers.some((a) => a.key)
    return (
      <main className="app">
        {soundToggle}
        <h1>Round Complete!</h1>
        <div className="stars">{starsFor(score).stars}</div>
        <p className="subtitle">{starsFor(score).message}</p>
        <div className="summary-stats">
          <div className="stat">
            <span className="stat-value">
              {score}/{ROUND_LENGTH}
            </span>
            <span className="stat-label">Score</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatSeconds(avgTimeMs)}</span>
            <span className="stat-label">Avg time</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatSeconds(totalTimeMs)}</span>
            <span className="stat-label">Total time</span>
          </div>
        </div>
        {best && (
          <p className="best-line">
            Best for this mode: {best.score}/{ROUND_LENGTH} · avg{' '}
            {formatSeconds(best.avgTimeMs)}
          </p>
        )}
        <table className="results">
          <thead>
            <tr>
              <th>#</th>
              <th>Note</th>
              <th>Clef</th>
              {hasKeys && <th>Key</th>}
              <th>Your answer</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {answers.map((a, i) => (
              <tr key={i} className={a.correct ? 'row-correct' : 'row-wrong'}>
                <td>{i + 1}</td>
                <td>{a.note}</td>
                <td>{a.clef}</td>
                {hasKeys && <td>{a.key}</td>}
                <td className="answer-cell">
                  {a.answer} {a.correct ? '✓' : '✗'}
                </td>
                <td>{formatSeconds(a.timeMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="summary-actions">
          <button className="primary" onClick={() => startRound(mode)}>
            Play again 🎮
          </button>
          <button onClick={() => setScreen('start')}>Change mode</button>
        </div>
      </main>
    )
  }

  // playing
  return (
    <main className="app">
      {soundToggle}
      <header className="hud">
        <span>
          🎵 {questionNumber}/{ROUND_LENGTH}
        </span>
        <span>🎯 {score}</span>
        <span>⏱️ {formatSeconds(totalTimeMs)}</span>
      </header>

      {question && (
        <>
          <div className="staff-wrap">
            <div className="staff-card">
              <Staff note={question.note} keySignature={question.key} />
            </div>
            {selected === question.answer && (
              <div className="burst" key={questionNumber}>
                {BURST_EMOJI.map((e, i) => (
                  <span key={i}>{e}</span>
                ))}
              </div>
            )}
          </div>
          {question.key && <p className="key-hint">Key: {question.key.name}</p>}
          <div className="options">
            {question.options.map((label) => {
              let cls = 'option'
              if (selected !== null) {
                if (label === question.answer) cls += ' correct'
                else if (label === selected) cls += ' wrong'
                else cls += ' dimmed'
              }
              return (
                <button
                  key={label}
                  className={cls}
                  onClick={() => handleAnswer(label)}
                  disabled={selected !== null}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <p className="feedback">
            {selected === null
              ? ' '
              : selected === question.answer
                ? `${PRAISE[answers.length % PRAISE.length]} ${question.answer}${question.note.octave} — ${formatSeconds(answers[answers.length - 1]?.timeMs ?? 0)}`
                : `Almost! It was ${question.answer}${question.note.octave}${question.key ? ` (${question.key.name})` : ''} 💪`}
          </p>
        </>
      )}
    </main>
  )
}
