import type { ClefMode } from './notes'
import type { GameState } from './useGame'
import { SoundToggle } from './SoundToggle'
import {
  GAMES,
  LEVELS,
  EAR_LEVELS,
  EAR_POOL_CHOICES,
  ROUND_LENGTH,
  loadBest,
  formatSeconds,
} from './gameConfig'

const CLEF_BUTTONS: [ClefMode, string][] = [
  ['treble', '🐦 Treble Clef 𝄞'],
  ['bass', '🐻 Bass Clef 𝄢'],
  ['alto', '🦊 Alto Clef 𝄡'],
  ['tenor', '🐸 Tenor Clef 𝄡'],
  ['both', '🎲 All Clefs'],
]

function bestLabel(b: ReturnType<typeof loadBest>) {
  return b
    ? `Best: ${b.score}/${ROUND_LENGTH} · avg ${formatSeconds(b.avgTimeMs)}`
    : 'No games yet'
}

export function StartScreen({ game }: { game: GameState }) {
  const {
    gameType,
    level,
    earPool,
    extended,
    reference,
    adaptive,
    levelKey,
  } = game

  return (
    <main className="app start">
      <SoundToggle soundOn={game.soundOn} onToggle={game.toggleSound} />
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
                  onClick={() => game.chooseGame(g.id)}
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
                    onClick={() => game.setLevel(l.id)}
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
                    onClick={() => game.setEarPool(p.id)}
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
                onClick={game.toggleReference}
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
                onClick={() => game.setExtended((e) => !e)}
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
                  onClick={game.toggleAdaptive}
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
            <button className="mode-button" onClick={() => game.startRound('both')}>
              <span className="mode-label">🎧 Start Listening!</span>
              <span className="mode-best">
                {bestLabel(loadBest('both', levelKey, 'ear', false))}
              </span>
            </button>
          ) : (
            CLEF_BUTTONS.map(([m, label]) => (
              <button key={m} className="mode-button" onClick={() => game.startRound(m)}>
                <span className="mode-label">{label}</span>
                <span className="mode-best">
                  {bestLabel(loadBest(m, levelKey, gameType, extended))}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <button className="stats-link" onClick={() => game.setScreen('stats')}>
        📊 My Stats
      </button>
    </main>
  )
}
