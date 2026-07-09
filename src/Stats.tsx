import { useMemo, useState } from 'react'
import { HeatStaff } from './Staff'
import type { HeatCell } from './Staff'
import { CLEFS, noteForPosition } from './notes'
import type { Clef, GameType } from './notes'
import { aggregatePositions, loadHistory } from './history'
import { GAMES, formatSeconds } from './gameConfig'

const GAME_LABELS = Object.fromEntries(GAMES.map((g) => [g.id, g.label])) as Record<
  GameType,
  string
>

function percent(correct: number, attempts: number): string {
  return attempts ? `${Math.round((correct / attempts) * 100)}%` : '—'
}

export function Stats({ onBack }: { onBack: () => void }) {
  const history = useMemo(loadHistory, [])

  const {
    totalAnswers,
    totalCorrect,
    totalMs,
    perGame,
    perPosition,
  } = useMemo(() => {
    const perGame = new Map<GameType, { attempts: number; correct: number; totalMs: number }>()
    // Note-position heatmap only makes sense for the note-naming game
    const perPosition = aggregatePositions(history)
    let totalAnswers = 0
    let totalCorrect = 0
    let totalMs = 0

    for (const round of history) {
      for (const a of round.answers) {
        totalAnswers++
        totalMs += a.timeMs
        if (a.correct) totalCorrect++

        const g = perGame.get(round.gameType) ?? { attempts: 0, correct: 0, totalMs: 0 }
        g.attempts++
        g.totalMs += a.timeMs
        if (a.correct) g.correct++
        perGame.set(round.gameType, g)
      }
    }
    return { totalAnswers, totalCorrect, totalMs, perGame, perPosition }
  }, [history])

  const clefsWithData = CLEFS.filter((c) =>
    [...perPosition.values()].some((p) => p.clef === c),
  )
  const [clefTab, setClefTab] = useState<Clef | null>(null)
  const activeClef = clefTab && clefsWithData.includes(clefTab) ? clefTab : clefsWithData[0]

  const heatCells: HeatCell[] = [...perPosition.values()]
    .filter((p) => p.clef === activeClef)
    .map((p) => ({
      position: p.position,
      accuracy: p.correct / p.attempts,
      attempts: p.attempts,
    }))

  // Weakest positions across all clefs: lowest accuracy, then slowest
  const practice = [...perPosition.values()]
    .filter((p) => p.attempts >= 2 && p.correct < p.attempts)
    .sort(
      (a, b) =>
        a.correct / a.attempts - b.correct / b.attempts ||
        b.totalMs / b.attempts - a.totalMs / a.attempts,
    )
    .slice(0, 5)

  if (totalAnswers === 0) {
    return (
      <main className="app">
        <h1>📊 My Stats</h1>
        <p className="subtitle">No games played yet — go play a round and come back! 🎮</p>
        <button className="primary" onClick={onBack}>
          Back
        </button>
      </main>
    )
  }

  return (
    <main className="app stats">
      <h1>📊 My Stats</h1>

      <div className="summary-stats">
        <div className="stat">
          <span className="stat-value">{history.length}</span>
          <span className="stat-label">Rounds</span>
        </div>
        <div className="stat">
          <span className="stat-value">{totalAnswers}</span>
          <span className="stat-label">Questions</span>
        </div>
        <div className="stat">
          <span className="stat-value">{percent(totalCorrect, totalAnswers)}</span>
          <span className="stat-label">Accuracy</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formatSeconds(totalMs / totalAnswers)}</span>
          <span className="stat-label">Avg time</span>
        </div>
      </div>

      <table className="results">
        <thead>
          <tr>
            <th>Game</th>
            <th>Questions</th>
            <th>Accuracy</th>
            <th>Avg time</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(GAME_LABELS) as GameType[])
            .filter((g) => perGame.has(g))
            .map((g) => {
              const s = perGame.get(g)!
              return (
                <tr key={g}>
                  <td>{GAME_LABELS[g]}</td>
                  <td>{s.attempts}</td>
                  <td>{percent(s.correct, s.attempts)}</td>
                  <td>{formatSeconds(s.totalMs / s.attempts)}</td>
                </tr>
              )
            })}
        </tbody>
      </table>

      {activeClef && (
        <>
          <h2 className="section-title">Your notes, colored by accuracy</h2>
          <div className="clef-tabs">
            {clefsWithData.map((c) => (
              <button
                key={c}
                className={`clef-tab${c === activeClef ? ' active' : ''}`}
                onClick={() => setClefTab(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="staff-card heat-card">
            <HeatStaff clef={activeClef} cells={heatCells} />
          </div>
          <p className="heat-legend">
            <span className="dot green" /> 80%+ <span className="dot amber" /> 50–79%{' '}
            <span className="dot red" /> below 50%
          </p>
        </>
      )}

      {practice.length > 0 && (
        <>
          <h2 className="section-title">Practice these! 💪</h2>
          <table className="results">
            <thead>
              <tr>
                <th>Note</th>
                <th>Clef</th>
                <th>Accuracy</th>
                <th>Avg time</th>
              </tr>
            </thead>
            <tbody>
              {practice.map((p) => {
                const note = noteForPosition(p.clef, p.position)
                return (
                  <tr key={`${p.clef}:${p.position}`}>
                    <td>
                      {note.letter}
                      {note.octave}
                    </td>
                    <td>{p.clef}</td>
                    <td>{percent(p.correct, p.attempts)}</td>
                    <td>{formatSeconds(p.totalMs / p.attempts)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}

      <button className="primary" onClick={onBack}>
        Back
      </button>
    </main>
  )
}
