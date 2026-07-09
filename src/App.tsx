import { useEffect, useRef, useState } from 'react'
import { Staff } from './Staff'
import { makeQuestion } from './notes'
import type { ClefMode, EarPool, GameType, Level, Question } from './notes'
import type { PositionWeight } from './notes'
import { playNotes } from './audio'
import { buildAdaptiveWeights, saveRound } from './history'
import { Stats } from './Stats'
import './App.css'

const ROUND_LENGTH = 10
const FEEDBACK_MS = 900

const GAMES: { id: GameType; label: string; blurb: string }[] = [
  { id: 'notes', label: '🎼 Notes', blurb: 'Name the note' },
  { id: 'intervals', label: '📏 Intervals', blurb: 'How far apart?' },
  { id: 'chords', label: '🎹 Chords', blurb: 'Name the root' },
  { id: 'ear', label: '🎧 Ear Training', blurb: 'Listen & guess' },
]

const LEVELS: { id: Level; label: string; blurb: string }[] = [
  { id: 'easy', label: '🌱 Easy', blurb: 'Natural notes only' },
  { id: 'medium', label: '🌟 Medium', blurb: 'Sharps & flats on the note' },
  { id: 'hard', label: '🚀 Hard', blurb: 'Key signatures (up to 7♯/7♭)' },
]

const EAR_LEVELS: { id: Level; label: string; blurb: string }[] = [
  { id: 'easy', label: '🐤 Higher or Lower', blurb: 'Which way did it go?' },
  { id: 'medium', label: '👂 Intervals', blurb: 'How far apart?' },
  { id: 'hard', label: '🎵 Chords', blurb: 'Major, minor…?' },
  { id: 'expert', label: '🦉 Name the Note', blurb: 'What note did you hear?' },
]

const PROMPTS: Record<GameType, string> = {
  notes: 'What note is this?',
  intervals: 'How far apart are the notes?',
  chords: 'Name the root (bottom) note!',
  ear: 'Listen carefully…',
}

const EAR_POOL_CHOICES: { id: EarPool; label: string; blurb: string }[] = [
  { id: 'natural', label: '🌱 Naturals', blurb: '7 white keys' },
  { id: 'some', label: '🌟 + F♯ & B♭', blurb: 'First accidentals' },
  { id: 'all', label: '🚀 All 12 notes', blurb: 'Sharps & flats' },
]

const EAR_PROMPTS: Record<Level, string> = {
  easy: 'Was the second note higher or lower?',
  medium: 'How far apart were the two notes?',
  hard: 'What kind of chord was that?',
  expert: 'What note was that?',
}

const PRAISE = ['Great job! 🎉', 'Awesome! ⭐', 'You rock! 🎸', 'Super! ✨', 'Wow! 🌈']
const BURST_EMOJI = ['🎉', '⭐', '🎵', '✨', '🎈', '🌟']

function starsFor(score: number): { stars: string; message: string } {
  if (score >= 9) return { stars: '🌟🌟🌟', message: 'Amazing! You are a note master!' }
  if (score >= 7) return { stars: '🌟🌟', message: 'Great playing! Almost perfect!' }
  if (score >= 4) return { stars: '🌟', message: 'Nice work! Keep practicing!' }
  return { stars: '💪', message: 'Good try! You will get it next time!' }
}

interface AnswerRecord {
  shown: string
  clef: string
  key?: string
  answer: string
  correct: boolean
  timeMs: number
  position: number
}

interface BestResult {
  score: number
  avgTimeMs: number
}

type Screen = 'start' | 'playing' | 'summary' | 'stats'

function bestKey(mode: ClefMode, level: string, gameType: GameType, extended: boolean) {
  // Note-naming at standard range keeps the original keys so old bests survive
  if (gameType === 'notes' && !extended) {
    return level === 'easy' ? `note-game-best-${mode}` : `note-game-best-${level}-${mode}`
  }
  // Levels distinguish notes and ear-training bests; intervals/chords have none
  const levelPart = gameType === 'intervals' || gameType === 'chords' ? 'any' : level
  return `note-game-best-${gameType}-${levelPart}-${extended ? 'ext' : 'std'}-${mode}`
}

function loadBest(
  mode: ClefMode,
  level: string,
  gameType: GameType,
  extended: boolean,
): BestResult | null {
  try {
    const raw = localStorage.getItem(bestKey(mode, level, gameType, extended))
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
  const [gameType, setGameType] = useState<GameType>('notes')
  const [extended, setExtended] = useState(false)
  const [earPool, setEarPool] = useState<EarPool>('natural')
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
  const [adaptive, setAdaptive] = useState(() => {
    try {
      return localStorage.getItem('note-game-adaptive') !== 'off'
    } catch {
      return true
    }
  })
  const [reference, setReference] = useState(() => {
    try {
      return localStorage.getItem('note-game-ear-reference') === 'on'
    } catch {
      return false
    }
  })
  const weightRef = useRef<PositionWeight | undefined>(undefined)
  const questionStartRef = useRef(0)
  const timeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timeoutRef.current), [])

  const score = answers.filter((a) => a.correct).length
  const totalTimeMs = answers.reduce((sum, a) => sum + a.timeMs, 0)

  // Reference note (a "do") only applies to the name-the-note ear level
  const refActive = gameType === 'ear' && level === 'expert' && reference

  // Best-score bucket: each name-the-note pool keeps its own best, and playing
  // with the reference note is easier so it gets a separate bucket too
  let levelKey: string = level
  if (gameType === 'ear' && level === 'expert') {
    levelKey = 'expert'
    if (earPool !== 'natural') levelKey += `-${earPool}`
    if (reference) levelKey += '-ref'
  }

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

  // Chord-ish sounds get a light roll; melodic ear questions a real gap
  // withReference: prepend a reference C (MIDI 60, "do") before the target so
  // the player can name it by relative pitch. Used when posing the question,
  // but not on the answer reveal (there we sound only the note itself).
  function playQuestion(q: Question, withReference = true) {
    if (refActive && withReference) {
      playNotes([60, ...q.midis], 0.75)
      return
    }
    playNotes(q.midis, gameType === 'ear' && level !== 'hard' ? 0.55 : 0.12)
  }

  function startRound(selectedMode: ClefMode) {
    setMode(selectedMode)
    setAnswers([])
    setSelected(null)
    setQuestionNumber(1)
    // Weights are computed once per round from the play history
    weightRef.current =
      adaptive && gameType === 'notes' ? buildAdaptiveWeights() : undefined
    const first = makeQuestion({
      mode: selectedMode,
      level,
      gameType,
      extended,
      weight: weightRef.current,
      earPool,
    })
    setQuestion(first)
    if (gameType === 'ear') playQuestion(first)
    setScreen('playing')
    questionStartRef.current = performance.now()
  }

  function toggleAdaptive() {
    setAdaptive((on) => {
      try {
        localStorage.setItem('note-game-adaptive', on ? 'off' : 'on')
      } catch {
        // preference just won't persist
      }
      return !on
    })
  }

  function toggleReference() {
    setReference((on) => {
      try {
        localStorage.setItem('note-game-ear-reference', on ? 'off' : 'on')
      } catch {
        // preference just won't persist
      }
      return !on
    })
  }

  function finishRound(finalAnswers: AnswerRecord[]) {
    saveRound({
      date: new Date().toISOString(),
      gameType,
      level,
      mode,
      extended,
      answers: finalAnswers.map((a) => ({
        position: a.position,
        clef: a.clef,
        correct: a.correct,
        timeMs: a.timeMs,
      })),
    })
    const finalScore = finalAnswers.filter((a) => a.correct).length
    const avgTimeMs =
      finalAnswers.reduce((sum, a) => sum + a.timeMs, 0) / finalAnswers.length

    const previous = loadBest(mode, levelKey, gameType, extended)
    const isBetter =
      !previous ||
      finalScore > previous.score ||
      (finalScore === previous.score && avgTimeMs < previous.avgTimeMs)
    if (isBetter) {
      const result = { score: finalScore, avgTimeMs }
      try {
        localStorage.setItem(
          bestKey(mode, levelKey, gameType, extended),
          JSON.stringify(result),
        )
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
    // Let the player hear what they just read (the correct pitches either way).
    // Ear training always sounds — it's the whole game.
    if (soundOn || gameType === 'ear') playQuestion(question, false)

    const record: AnswerRecord = {
      shown: question.display,
      clef: question.clef,
      key: question.key?.name,
      answer: label,
      correct: label === question.answer,
      timeMs,
      position: question.notes[0].staffPosition,
    }
    const nextAnswers = [...answers, record]
    setAnswers(nextAnswers)

    timeoutRef.current = window.setTimeout(() => {
      if (nextAnswers.length >= ROUND_LENGTH) {
        finishRound(nextAnswers)
      } else {
        setSelected(null)
        setQuestionNumber((n) => n + 1)
        const next = makeQuestion({
          mode,
          level,
          gameType,
          extended,
          previous: question,
          weight: weightRef.current,
          earPool,
        })
        setQuestion(next)
        if (gameType === 'ear') playQuestion(next)
        questionStartRef.current = performance.now()
      }
    }, FEEDBACK_MS)
  }

  if (screen === 'stats') {
    return <Stats onBack={() => setScreen('start')} />
  }

  if (screen === 'start') {
    return (
      <main className="app start">
        {soundToggle}
        <h1>🎵 Note Reading Trainer 🎶</h1>
        <p className="subtitle">
          Can you name the notes? {ROUND_LENGTH} notes per round — be quick and
          score big!
        </p>

        <div className="start-columns">
        <div className="setup">
        <div className="picker-group">
          <span className="picker-label">🎮 Choose a game</span>
          <div className="level-picker game-picker" role="radiogroup" aria-label="Game">
            {GAMES.map((g) => (
              <button
                key={g.id}
                role="radio"
                aria-checked={gameType === g.id}
                className={`level-button${gameType === g.id ? ' active' : ''}`}
                onClick={() => {
                  setGameType(g.id)
                  // 'expert' only exists in ear training
                  if (g.id !== 'ear' && level === 'expert') setLevel('easy')
                }}
              >
                <span className="level-label">{g.label}</span>
                <span className="level-blurb">{g.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        {(gameType === 'notes' || gameType === 'ear') && (
          <div className="picker-group">
            <span className="picker-label">⭐ Difficulty</span>
            <div
              className={`chip-picker${gameType === 'ear' ? ' cols-2' : ''}`}
              role="radiogroup"
              aria-label="Difficulty"
            >
              {(gameType === 'ear' ? EAR_LEVELS : LEVELS).map((l) => (
                <button
                  key={l.id}
                  role="radio"
                  aria-checked={level === l.id}
                  className={`chip-button${level === l.id ? ' active' : ''}`}
                  onClick={() => setLevel(l.id)}
                >
                  <span className="chip-label">{l.label}</span>
                  <span className="level-blurb">{l.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {gameType === 'ear' && level === 'expert' && (
          <div className="picker-group">
            <span className="picker-label">🎵 Which notes</span>
            <div className="chip-picker" role="radiogroup" aria-label="Note pool">
              {EAR_POOL_CHOICES.map((p) => (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={earPool === p.id}
                  className={`chip-button${earPool === p.id ? ' active' : ''}`}
                  onClick={() => setEarPool(p.id)}
                >
                  <span className="chip-label">{p.label}</span>
                  <span className="level-blurb">{p.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {gameType === 'ear' && level === 'expert' && (
          <div className="toggle-row">
            <button
              className={`toggle-button${reference ? ' active' : ''}`}
              role="switch"
              aria-checked={reference}
              onClick={toggleReference}
            >
              🎯 Reference note {reference ? 'ON' : 'OFF'}
              <span className="level-blurb">
                {reference ? 'Hear a “C” first' : 'No help note'}
              </span>
            </button>
          </div>
        )}

        {gameType !== 'ear' && (
        <div className="toggle-row">
          <button
            className={`toggle-button${extended ? ' active' : ''}`}
            role="switch"
            aria-checked={extended}
            onClick={() => setExtended((e) => !e)}
          >
            🪜 Extended range {extended ? 'ON' : 'OFF'}
            <span className="level-blurb">
              {extended ? 'Up to 3 ledger lines' : '1 ledger line'}
            </span>
          </button>
          {gameType === 'notes' && (
            <button
              className={`toggle-button${adaptive ? ' active' : ''}`}
              role="switch"
              aria-checked={adaptive}
              onClick={toggleAdaptive}
            >
              🧠 Smart practice {adaptive ? 'ON' : 'OFF'}
              <span className="level-blurb">
                {adaptive ? 'Drills your trickiest notes' : 'All notes equally'}
              </span>
            </button>
          )}
        </div>
        )}
        </div>

        <div className="mode-buttons">
          {gameType === 'ear' ? (
            (() => {
              const b = loadBest('both', levelKey, 'ear', false)
              return (
                <button className="mode-button" onClick={() => startRound('both')}>
                  <span className="mode-label">🎧 Start Listening!</span>
                  <span className="mode-best">
                    {b
                      ? `Best: ${b.score}/${ROUND_LENGTH} · avg ${formatSeconds(b.avgTimeMs)}`
                      : 'No games yet'}
                  </span>
                </button>
              )
            })()
          ) : (
            (
              [
                ['treble', '🐦 Treble Clef 𝄞'],
                ['bass', '🐻 Bass Clef 𝄢'],
                ['alto', '🦊 Alto Clef 𝄡'],
                ['tenor', '🐸 Tenor Clef 𝄡'],
                ['both', '🎲 All Clefs'],
              ] as [ClefMode, string][]
            ).map(([m, label]) => {
              const b = loadBest(m, levelKey, gameType, extended)
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
            })
          )}
        </div>
        </div>

        <button className="stats-link" onClick={() => setScreen('stats')}>
          📊 My Stats
        </button>
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
              <th>Question</th>
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
                <td>{a.shown}</td>
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
          <button onClick={() => setScreen('stats')}>📊 Stats</button>
        </div>
      </main>
    )
  }

  // playing
  return (
    <main className="app playing">
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
            {gameType === 'ear' && selected === null ? (
              <div className="staff-card ear-card">
                <div className="ear-emoji">🎧</div>
                <button className="replay" onClick={() => playQuestion(question)}>
                  🔊 Hear it again
                </button>
              </div>
            ) : (
              <div className="staff-card">
                <Staff notes={question.notes} keySignature={question.key} />
              </div>
            )}
            {selected === question.answer && (
              <div className="burst" key={questionNumber}>
                {BURST_EMOJI.map((e, i) => (
                  <span key={i}>{e}</span>
                ))}
              </div>
            )}
          </div>
          <p className="key-hint">
            {question.key
              ? `Key: ${question.key.name}`
              : gameType === 'ear'
                ? refActive && selected === null
                  ? 'What note was that? (after the “C”)'
                  : EAR_PROMPTS[level]
                : PROMPTS[gameType]}
          </p>
          <div
            className={`options${question.options.some((o) => o.length > 2) ? ' words' : ''}`}
            style={
              question.options.length < 4
                ? { gridTemplateColumns: `repeat(${question.options.length}, 1fr)` }
                : undefined
            }
          >
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
                ? `${PRAISE[answers.length % PRAISE.length]} ${question.display} — ${formatSeconds(answers[answers.length - 1]?.timeMs ?? 0)}`
                : `Almost! It was ${question.display}${question.key ? ` (${question.key.name})` : ''} 💪`}
          </p>
        </>
      )}
    </main>
  )
}
