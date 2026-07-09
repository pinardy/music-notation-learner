import type { ClefMode, GameType, Level } from './notes'

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
