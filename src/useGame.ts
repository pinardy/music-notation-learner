import { useEffect, useRef, useState } from 'react'
import { makeQuestion } from './notes'
import type { ClefMode, EarPool, GameType, Level, PositionWeight, Question } from './notes'
import { playNotes } from './audio'
import { buildAdaptiveWeights, saveRound } from './history'
import { usePersistentFlag } from './usePersistentFlag'
import {
  ROUND_LENGTH,
  FEEDBACK_MS,
  bestKey,
  loadBest,
  type AnswerRecord,
  type BestResult,
  type Screen,
} from './gameConfig'

export type GameState = ReturnType<typeof useGame>

export function useGame() {
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
  const [soundOn, toggleSound] = usePersistentFlag('note-game-sound', true)
  const [adaptive, toggleAdaptive] = usePersistentFlag('note-game-adaptive', true)
  const [reference, toggleReference] = usePersistentFlag('note-game-ear-reference', false)
  // When set, the round replays this fixed list of questions (a review round)
  // instead of generating new ones; null means a normal round.
  const [reviewQueue, setReviewQueue] = useState<Question[] | null>(null)
  const weightRef = useRef<PositionWeight | undefined>(undefined)
  const questionStartRef = useRef(0)
  const timeoutRef = useRef<number | undefined>(undefined)
  // Full Question objects shown this round, parallel to `answers`, so a review
  // round can replay exactly the ones that were missed.
  const askedRef = useRef<Question[]>([])

  useEffect(() => () => window.clearTimeout(timeoutRef.current), [])

  const score = answers.filter((a) => a.correct).length
  const totalTimeMs = answers.reduce((sum, a) => sum + a.timeMs, 0)
  const roundLength = reviewQueue ? reviewQueue.length : ROUND_LENGTH

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

  function chooseGame(id: GameType) {
    setGameType(id)
    // 'expert' only exists in ear training
    if (id !== 'ear' && level === 'expert') setLevel('easy')
  }

  // Chord-ish sounds get a light roll; melodic ear questions a real gap.
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
    setReviewQueue(null)
    setAnswers([])
    setSelected(null)
    setQuestionNumber(1)
    askedRef.current = []
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

  // Abandon the current round and return to the menu. Cancels the pending
  // next-question timer so it can't fire (and e.g. jump to the summary) after
  // leaving; the partial round is discarded, not recorded.
  function exitToMenu() {
    window.clearTimeout(timeoutRef.current)
    setReviewQueue(null)
    setQuestion(null)
    setSelected(null)
    setAnswers([])
    askedRef.current = []
    setScreen('start')
  }

  // Replay exactly the questions missed this round, in order
  function startReviewRound() {
    const missed = askedRef.current.filter((_, i) => !answers[i]?.correct)
    if (missed.length === 0) return
    setReviewQueue(missed)
    setAnswers([])
    setSelected(null)
    setQuestionNumber(1)
    askedRef.current = []
    const first = missed[0]
    setQuestion(first)
    if (gameType === 'ear') playQuestion(first)
    setScreen('playing')
    questionStartRef.current = performance.now()
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
    // Review rounds are variable-length practice — they still feed stats and
    // adaptive weighting (saved above) but don't compete for a best score
    if (reviewQueue) {
      setBest(null)
      setScreen('summary')
      return
    }

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
    askedRef.current = [...askedRef.current, question]

    timeoutRef.current = window.setTimeout(() => {
      if (nextAnswers.length >= roundLength) {
        finishRound(nextAnswers)
      } else {
        setSelected(null)
        setQuestionNumber((n) => n + 1)
        // In a review round, replay the stored question; otherwise generate one
        const next = reviewQueue
          ? reviewQueue[nextAnswers.length]
          : makeQuestion({
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

  return {
    // state
    screen,
    setScreen,
    mode,
    level,
    setLevel,
    gameType,
    extended,
    setExtended,
    earPool,
    setEarPool,
    question,
    questionNumber,
    answers,
    selected,
    best,
    soundOn,
    adaptive,
    reference,
    reviewQueue,
    // derived
    score,
    totalTimeMs,
    roundLength,
    refActive,
    levelKey,
    // actions
    chooseGame,
    toggleSound,
    toggleAdaptive,
    toggleReference,
    playQuestion,
    startRound,
    startReviewRound,
    handleAnswer,
    exitToMenu,
  }
}
