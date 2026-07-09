import type { Clef, ClefMode, GameType, Level } from './notes'
import { CLEFS } from './notes'

export interface HistoryAnswer {
  /** Staff position of the (bottom) note — lets stats recompute the note per clef */
  position?: number
  clef: string
  correct: boolean
  timeMs: number
}

export interface RoundRecord {
  date: string
  gameType: GameType
  level: Level
  mode: ClefMode
  extended: boolean
  answers: HistoryAnswer[]
}

const KEY = 'note-game-history'
const MAX_ROUNDS = 300

export function loadHistory(): RoundRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveRound(round: RoundRecord) {
  try {
    const history = [...loadHistory(), round].slice(-MAX_ROUNDS)
    localStorage.setItem(KEY, JSON.stringify(history))
  } catch {
    // localStorage unavailable — stats just won't accumulate
  }
}

export interface PositionStats {
  clef: Clef
  position: number
  attempts: number
  correct: number
  totalMs: number
}

/** Per clef+staff-position aggregates from the note-naming game */
export function aggregatePositions(history: RoundRecord[]): Map<string, PositionStats> {
  const map = new Map<string, PositionStats>()
  for (const round of history) {
    if (round.gameType !== 'notes') continue
    for (const a of round.answers) {
      if (a.position === undefined) continue
      const clef = a.clef as Clef
      if (!CLEFS.includes(clef)) continue
      const key = `${clef}:${a.position}`
      const p =
        map.get(key) ?? { clef, position: a.position, attempts: 0, correct: 0, totalMs: 0 }
      p.attempts++
      p.totalMs += a.timeMs
      if (a.correct) p.correct++
      map.set(key, p)
    }
  }
  return map
}

/**
 * Weight function for adaptive question selection: positions the player
 * misses often or answers slowly come up more; unseen positions get a small
 * boost so coverage broadens over time.
 */
export function buildAdaptiveWeights(
  history: RoundRecord[] = loadHistory(),
): (clef: Clef, position: number) => number {
  const agg = aggregatePositions(history)
  if (agg.size === 0) return () => 1

  let attempts = 0
  let totalMs = 0
  for (const p of agg.values()) {
    attempts += p.attempts
    totalMs += p.totalMs
  }
  const overallAvgMs = totalMs / attempts

  return (clef, position) => {
    const s = agg.get(`${clef}:${position}`)
    if (!s) return 1.5
    let weight = 1
    weight += (1 - s.correct / s.attempts) * 3
    if (s.attempts >= 2 && overallAvgMs > 0) {
      const slowness = s.totalMs / s.attempts / overallAvgMs
      if (slowness > 1) weight += Math.min(slowness - 1, 1) * 1.5
    }
    return weight
  }
}
