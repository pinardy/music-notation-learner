import type { GameState } from './useGame'
import { SoundToggle } from './SoundToggle'
import { ROUND_LENGTH, starsFor, formatSeconds } from './gameConfig'

export function SummaryScreen({ game }: { game: GameState }) {
  const { answers, score, totalTimeMs, roundLength, best, reviewQueue } = game
  const avgTimeMs = totalTimeMs / answers.length
  const hasKeys = answers.some((a) => a.key)
  const isReview = reviewQueue !== null
  const missedCount = answers.filter((a) => !a.correct).length
  const rating = starsFor(score, roundLength)

  return (
    <main className="app">
      <SoundToggle soundOn={game.soundOn} onToggle={game.toggleSound} />
      <h1>{isReview ? 'Review Complete!' : 'Round Complete!'}</h1>
      <div className="stars">{rating.stars}</div>
      <p className="subtitle">{rating.message}</p>
      <div className="summary-stats">
        <div className="stat">
          <span className="stat-value">
            {score}/{roundLength}
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
        {missedCount > 0 && (
          <button className="primary" onClick={game.startReviewRound}>
            Practice {missedCount} miss{missedCount > 1 ? 'es' : ''} 💪
          </button>
        )}
        <button
          className={missedCount > 0 ? undefined : 'primary'}
          onClick={() => game.startRound(game.mode)}
        >
          Play again 🎮
        </button>
        <button onClick={() => game.setScreen('start')}>Change mode</button>
        <button onClick={() => game.setScreen('stats')}>📊 Stats</button>
      </div>
    </main>
  )
}
