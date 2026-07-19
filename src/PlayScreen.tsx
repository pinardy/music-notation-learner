import { Staff } from './Staff'
import type { GameState } from './useGame'
import { SoundToggle } from './SoundToggle'
import { PROMPTS, EAR_PROMPTS, PRAISE, BURST_EMOJI, formatSeconds } from './gameConfig'

export function PlayScreen({ game }: { game: GameState }) {
  const {
    question,
    questionNumber,
    roundLength,
    reviewQueue,
    score,
    totalTimeMs,
    gameType,
    level,
    selected,
    refActive,
    answers,
  } = game

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
          {reviewQueue ? '💪' : '🎵'} {questionNumber}/{roundLength}
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
                <button className="replay" onClick={() => game.playQuestion(question)}>
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
                  onClick={() => game.handleAnswer(label)}
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
