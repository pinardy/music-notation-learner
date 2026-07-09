import type { ClefMode, EarPool, GameType, Level } from './notes'

export const ROUND_LENGTH = 10
export const FEEDBACK_MS = 900

export const GAMES: { id: GameType; label: string; blurb: string }[] = [
  { id: 'notes', label: '🎼 Notes', blurb: 'Name the note' },
  { id: 'intervals', label: '📏 Intervals', blurb: 'How far apart?' },
  { id: 'chords', label: '🎹 Chords', blurb: 'Name the root' },
  { id: 'ear', label: '🎧 Ear Training', blurb: 'Listen & guess' },
]

export const LEVELS: { id: Level; label: string; blurb: string }[] = [
  { id: 'easy', label: '🌱 Easy', blurb: 'Natural notes only' },
  { id: 'medium', label: '🌟 Medium', blurb: 'Sharps & flats on the note' },
  { id: 'hard', label: '🚀 Hard', blurb: 'Key signatures (up to 7♯/7♭)' },
]

export const EAR_LEVELS: { id: Level; label: string; blurb: string }[] = [
  { id: 'easy', label: '🐤 Higher or Lower', blurb: 'Which way did it go?' },
  { id: 'medium', label: '👂 Intervals', blurb: 'How far apart?' },
  { id: 'hard', label: '🎵 Chords', blurb: 'Major, minor…?' },
  { id: 'expert', label: '🦉 Name the Note', blurb: 'What note did you hear?' },
]

export const PROMPTS: Record<GameType, string> = {
  notes: 'What note is this?',
  intervals: 'How far apart are the notes?',
  chords: 'Name the root (bottom) note!',
  ear: 'Listen carefully…',
}

export const EAR_POOL_CHOICES: { id: EarPool; label: string; blurb: string }[] = [
  { id: 'natural', label: '🌱 Naturals', blurb: '7 white keys' },
  { id: 'some', label: '🌟 + F♯ & B♭', blurb: 'First accidentals' },
  { id: 'all', label: '🚀 All 12 notes', blurb: 'Sharps & flats' },
]

export const EAR_PROMPTS: Record<Level, string> = {
  easy: 'Was the second note higher or lower?',
  medium: 'How far apart were the two notes?',
  hard: 'What kind of chord was that?',
  expert: 'What note was that?',
}

export const PRAISE = ['Great job! 🎉', 'Awesome! ⭐', 'You rock! 🎸', 'Super! ✨', 'Wow! 🌈']
export const BURST_EMOJI = ['🎉', '⭐', '🎵', '✨', '🎈', '🌟']

export interface AnswerRecord {
  shown: string
  clef: string
  key?: string
  answer: string
  correct: boolean
  timeMs: number
  position: number
}

export interface BestResult {
  score: number
  avgTimeMs: number
}

export type Screen = 'start' | 'playing' | 'summary' | 'stats'

export function starsFor(score: number, total: number): { stars: string; message: string } {
  const ratio = total > 0 ? score / total : 0
  if (ratio >= 0.9) return { stars: '🌟🌟🌟', message: 'Amazing! You are a note master!' }
  if (ratio >= 0.7) return { stars: '🌟🌟', message: 'Great playing! Almost perfect!' }
  if (ratio >= 0.4) return { stars: '🌟', message: 'Nice work! Keep practicing!' }
  return { stars: '💪', message: 'Good try! You will get it next time!' }
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

export function bestKey(mode: ClefMode, level: string, gameType: GameType, extended: boolean) {
  // Note-naming at standard range keeps the original keys so old bests survive
  if (gameType === 'notes' && !extended) {
    return level === 'easy' ? `note-game-best-${mode}` : `note-game-best-${level}-${mode}`
  }
  // Levels distinguish notes and ear-training bests; intervals/chords have none
  const levelPart = gameType === 'intervals' || gameType === 'chords' ? 'any' : level
  return `note-game-best-${gameType}-${levelPart}-${extended ? 'ext' : 'std'}-${mode}`
}

export function loadBest(
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
