import { useGame } from './useGame'
import { StartScreen } from './StartScreen'
import { PlayScreen } from './PlayScreen'
import { SummaryScreen } from './SummaryScreen'
import { Stats } from './Stats'
import './App.css'

export default function App() {
  const game = useGame()

  if (game.screen === 'stats') return <Stats onBack={() => game.setScreen('start')} />
  if (game.screen === 'start') return <StartScreen game={game} />
  if (game.screen === 'summary') return <SummaryScreen game={game} />
  return <PlayScreen game={game} />
}
