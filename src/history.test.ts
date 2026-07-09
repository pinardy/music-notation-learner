import { describe, it, expect } from 'vitest'
import { aggregatePositions, buildAdaptiveWeights, type RoundRecord } from './history'

function round(partial: Partial<RoundRecord> & Pick<RoundRecord, 'answers'>): RoundRecord {
  return {
    date: '2026-01-01T00:00:00.000Z',
    gameType: 'notes',
    level: 'easy',
    mode: 'treble',
    extended: false,
    ...partial,
  }
}

describe('aggregatePositions', () => {
  it('sums attempts, correct, and time per clef+position', () => {
    const history: RoundRecord[] = [
      round({
        answers: [
          { position: 0, clef: 'treble', correct: true, timeMs: 1000 },
          { position: 0, clef: 'treble', correct: false, timeMs: 2000 },
          { position: 3, clef: 'treble', correct: true, timeMs: 500 },
        ],
      }),
    ]
    const agg = aggregatePositions(history)
    expect(agg.get('treble:0')).toMatchObject({ attempts: 2, correct: 1, totalMs: 3000 })
    expect(agg.get('treble:3')).toMatchObject({ attempts: 1, correct: 1, totalMs: 500 })
  })

  it('ignores non-note games and missing/invalid data', () => {
    const history: RoundRecord[] = [
      round({ gameType: 'intervals', answers: [{ position: 0, clef: 'treble', correct: true, timeMs: 1 }] }),
      round({ answers: [{ clef: 'treble', correct: true, timeMs: 1 }] }), // no position
      round({ answers: [{ position: 1, clef: 'nonsense', correct: true, timeMs: 1 }] }), // bad clef
    ]
    expect(aggregatePositions(history).size).toBe(0)
  })

  it('separates the same position across different clefs', () => {
    const history: RoundRecord[] = [
      round({ answers: [{ position: 0, clef: 'treble', correct: true, timeMs: 1 }] }),
      round({ mode: 'bass', answers: [{ position: 0, clef: 'bass', correct: false, timeMs: 1 }] }),
    ]
    const agg = aggregatePositions(history)
    expect(agg.size).toBe(2)
    expect(agg.get('treble:0')!.correct).toBe(1)
    expect(agg.get('bass:0')!.correct).toBe(0)
  })
})

describe('buildAdaptiveWeights', () => {
  it('weights every position equally when there is no history', () => {
    const w = buildAdaptiveWeights([])
    expect(w('treble', 0)).toBe(1)
    expect(w('treble', 5)).toBe(1)
  })

  it('weights a frequently-missed note above a mastered one', () => {
    const history: RoundRecord[] = [
      round({
        answers: [
          // position 0: always wrong
          { position: 0, clef: 'treble', correct: false, timeMs: 1000 },
          { position: 0, clef: 'treble', correct: false, timeMs: 1000 },
          // position 2: always right
          { position: 2, clef: 'treble', correct: true, timeMs: 1000 },
          { position: 2, clef: 'treble', correct: true, timeMs: 1000 },
        ],
      }),
    ]
    const w = buildAdaptiveWeights(history)
    expect(w('treble', 0)).toBeGreaterThan(w('treble', 2))
    // a perfectly-mastered note falls to the baseline weight of 1
    expect(w('treble', 2)).toBeCloseTo(1)
  })

  it('gives unseen positions a mild boost above mastered ones', () => {
    const history: RoundRecord[] = [
      round({
        answers: [{ position: 2, clef: 'treble', correct: true, timeMs: 1000 }],
      }),
    ]
    const w = buildAdaptiveWeights(history)
    expect(w('treble', 9)).toBe(1.5) // never seen
    expect(w('treble', 9)).toBeGreaterThan(w('treble', 2))
  })

  it('raises weight for notes answered slowly', () => {
    const history: RoundRecord[] = [
      round({
        answers: [
          // both correct, but position 0 is much slower than average
          { position: 0, clef: 'treble', correct: true, timeMs: 8000 },
          { position: 0, clef: 'treble', correct: true, timeMs: 8000 },
          { position: 2, clef: 'treble', correct: true, timeMs: 400 },
          { position: 2, clef: 'treble', correct: true, timeMs: 400 },
        ],
      }),
    ]
    const w = buildAdaptiveWeights(history)
    expect(w('treble', 0)).toBeGreaterThan(w('treble', 2))
  })
})
