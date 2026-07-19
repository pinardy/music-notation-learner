import { useGame } from './useGame'
import { StartScreen } from './StartScreen'
import { PlayScreen } from './PlayScreen'
import { SummaryScreen } from './SummaryScreen'
import { Stats } from './Stats'
import { SightScreen } from './SightScreen'
import { ThemeToggle } from './ThemeToggle'
import './App.css'

export default function App() {
  const game = useGame()

  const screen =
    game.screen === 'stats' ? (
      <Stats onBack={() => game.setScreen('start')} />
    ) : game.screen === 'start' ? (
      <StartScreen game={game} />
    ) : game.screen === 'summary' ? (
      <SummaryScreen game={game} />
    ) : game.screen === 'sight' ? (
      <SightScreen game={game} />
    ) : (
      <PlayScreen game={game} />
    )

  return (
    <>
      <ThemeToggle />
      {screen}
    </>
  )
}
