import { describe, it, expect } from 'vitest'
import {
  makeQuestion,
  noteForPosition,
  noteLabel,
  midiOf,
  KEYS,
  CLEFS,
  INTERVAL_NAMES,
  TRIAD_QUALITIES,
  TRIAD_ROOTS,
  type Clef,
  type Question,
} from './notes'

// Pitch class (0-11) of a label, for verifying audio matches the shown answer
const PITCH_CLASS: Record<string, number> = {
  C: 0,
  'C♯/D♭': 1,
  D: 2,
  'D♯/E♭': 3,
  E: 4,
  F: 5,
  'F♯/G♭': 6,
  G: 7,
  'G♯/A♭': 8,
  A: 9,
  'A♯/B♭': 10,
  B: 11,
  // single-accidental labels used by the "some" pool
  'F♯': 6,
  'B♭': 10,
}

function times<T>(n: number, fn: () => T): T[] {
  return Array.from({ length: n }, fn)
}

describe('noteLabel', () => {
  it('formats naturals and accidentals', () => {
    expect(noteLabel('C')).toBe('C')
    expect(noteLabel('F', 'sharp')).toBe('F♯')
    expect(noteLabel('B', 'flat')).toBe('B♭')
  })
})

describe('midiOf', () => {
  it('maps standard pitches to MIDI numbers', () => {
    expect(midiOf('C', 4)).toBe(60) // middle C
    expect(midiOf('A', 4)).toBe(69) // A440
    expect(midiOf('C', 5)).toBe(72)
    expect(midiOf('E', 2)).toBe(40)
  })
  it('shifts a semitone for accidentals', () => {
    expect(midiOf('F', 4, 'sharp')).toBe(66)
    expect(midiOf('B', 4, 'flat')).toBe(70)
    // enharmonic equivalents land on the same MIDI number
    expect(midiOf('F', 4, 'sharp')).toBe(midiOf('G', 4, 'flat'))
  })
})

describe('noteForPosition', () => {
  it('round-trips the staff position', () => {
    for (const clef of CLEFS) {
      for (let p = -4; p <= 12; p++) {
        expect(noteForPosition(clef, p).staffPosition).toBe(p)
        expect(noteForPosition(clef, p).clef).toBe(clef)
      }
    }
  })
  it('names known landmark positions', () => {
    // Bottom line: E4 treble, G2 bass, F3 alto, D3 tenor
    expect(noteForPosition('treble', 0)).toMatchObject({ letter: 'E', octave: 4 })
    expect(noteForPosition('bass', 0)).toMatchObject({ letter: 'G', octave: 2 })
    expect(noteForPosition('alto', 0)).toMatchObject({ letter: 'F', octave: 3 })
    expect(noteForPosition('tenor', 0)).toMatchObject({ letter: 'D', octave: 3 })
    // Treble line D5 is two steps (a third) above B4 at position 6
    expect(noteForPosition('treble', 6)).toMatchObject({ letter: 'D', octave: 5 })
  })
})

describe('key signatures', () => {
  it('covers all 14 major keys, 1-7 accidentals each way', () => {
    const sharps = KEYS.filter((k) => k.accidental === 'sharp')
    const flats = KEYS.filter((k) => k.accidental === 'flat')
    expect(sharps.map((k) => k.letters.length)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(flats.map((k) => k.letters.length)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('alters letters in the standard order of sharps/flats', () => {
    const sevenSharps = KEYS.find((k) => k.accidental === 'sharp' && k.letters.length === 7)!
    const sevenFlats = KEYS.find((k) => k.accidental === 'flat' && k.letters.length === 7)!
    expect(sevenSharps.letters).toEqual(['F', 'C', 'G', 'D', 'A', 'E', 'B'])
    expect(sevenFlats.letters).toEqual(['B', 'E', 'A', 'D', 'G', 'C', 'F'])
  })

  it('draws every glyph on a staff position that spells the altered letter', () => {
    // Independent invariant: the Nth accidental must sit on a line/space whose
    // letter equals the Nth altered letter, in every clef. This validates the
    // whole position table — including the tricky tenor-sharp exception —
    // without hardcoding the numbers under test.
    for (const key of KEYS) {
      for (const clef of CLEFS) {
        const positions = key.positions[clef]
        expect(positions).toHaveLength(key.letters.length)
        positions.forEach((pos, i) => {
          expect(noteForPosition(clef, pos).letter).toBe(key.letters[i])
          // glyphs stay within one ledger line of the staff
          expect(pos).toBeGreaterThanOrEqual(-2)
          expect(pos).toBeLessThanOrEqual(10)
        })
      }
    }
  })
})

function expectValidOptions(q: Question, expectedCount = 4) {
  expect(q.options).toContain(q.answer)
  expect(q.options).toHaveLength(expectedCount)
  expect(new Set(q.options).size).toBe(expectedCount) // no duplicates
}

describe('note-naming questions', () => {
  it('easy: a single natural note, answer among 4 letter options', () => {
    for (const q of times(100, () => makeQuestion({ mode: 'treble', level: 'easy', gameType: 'notes', extended: false }))) {
      expect(q.notes).toHaveLength(1)
      expect(q.notes[0].accidental).toBeUndefined()
      expect(q.answer).toBe(q.notes[0].letter)
      expectValidOptions(q)
    }
  })

  it('hard: applies the key signature to the plain note', () => {
    for (const q of times(200, () => makeQuestion({ mode: 'treble', level: 'hard', gameType: 'notes', extended: false }))) {
      expect(q.key).toBeDefined()
      const altered = q.key!.letters.includes(q.notes[0].letter)
      // The answer's accidental must reflect the key when the letter is altered
      expect(q.answer).toBe(
        altered ? noteLabel(q.notes[0].letter, q.key!.accidental) : q.notes[0].letter,
      )
      expectValidOptions(q)
    }
  })

  it('respects adaptive weights (forced single position)', () => {
    const weight = (_clef: Clef, pos: number) => (pos === 2 ? 1 : 0)
    for (const q of times(50, () => makeQuestion({ mode: 'treble', level: 'easy', gameType: 'notes', extended: false, weight }))) {
      expect(q.notes[0].staffPosition).toBe(2)
    }
  })

  it('extended range reaches further than standard range', () => {
    const std = times(300, () => makeQuestion({ mode: 'treble', level: 'easy', gameType: 'notes', extended: false }))
    const ext = times(300, () => makeQuestion({ mode: 'treble', level: 'easy', gameType: 'notes', extended: true }))
    const spread = (qs: Question[]) => {
      const ps = qs.map((q) => q.notes[0].staffPosition)
      return Math.max(...ps) - Math.min(...ps)
    }
    expect(spread(ext)).toBeGreaterThan(spread(std))
  })
})

describe('interval questions', () => {
  it('names match the diatonic distance between the two notes', () => {
    for (const q of times(300, () => makeQuestion({ mode: 'bass', level: 'easy', gameType: 'intervals', extended: false }))) {
      expect(q.notes).toHaveLength(2)
      const steps = q.notes[1].staffPosition - q.notes[0].staffPosition
      expect(steps).toBeGreaterThanOrEqual(1)
      expect(steps).toBeLessThanOrEqual(7)
      expect(q.answer).toBe(INTERVAL_NAMES[steps - 1])
      expectValidOptions(q)
    }
  })
})

describe('chord questions', () => {
  it('are stacked thirds with the root as the answer', () => {
    for (const q of times(200, () => makeQuestion({ mode: 'treble', level: 'easy', gameType: 'chords', extended: false }))) {
      expect(q.notes).toHaveLength(3)
      expect(q.notes[1].staffPosition - q.notes[0].staffPosition).toBe(2)
      expect(q.notes[2].staffPosition - q.notes[1].staffPosition).toBe(2)
      expect(q.answer).toBe(q.notes[0].letter)
      expectValidOptions(q)
    }
  })
})

describe('ear training', () => {
  it('easy: two notes a third+ apart, direction matches pitch', () => {
    for (const q of times(200, () => makeQuestion({ mode: 'both', level: 'easy', gameType: 'ear', extended: false }))) {
      expect(q.options).toEqual(['Higher ⬆️', 'Lower ⬇️'])
      expect(Math.abs(q.notes[1].staffPosition - q.notes[0].staffPosition)).toBeGreaterThanOrEqual(2)
      const wentUp = q.midis[1] > q.midis[0]
      expect(q.answer).toBe(wentUp ? 'Higher ⬆️' : 'Lower ⬇️')
    }
  })

  it('hard: chord quality matches the actual semitone pattern', () => {
    const PATTERN: Record<string, [number, number]> = {
      Major: [4, 3],
      Minor: [3, 4],
      Diminished: [3, 3],
    }
    for (const q of times(300, () => makeQuestion({ mode: 'both', level: 'hard', gameType: 'ear', extended: false }))) {
      expect(q.options).toEqual(TRIAD_QUALITIES)
      expect(TRIAD_QUALITIES).toContain(q.answer)
      // all-natural triad
      expect(q.notes.every((n) => !n.accidental)).toBe(true)
      // the sounded pitches must actually form the claimed quality
      const gaps: [number, number] = [q.midis[1] - q.midis[0], q.midis[2] - q.midis[1]]
      expect(gaps).toEqual(PATTERN[q.answer])
      // and the root letter must belong to that quality
      expect(TRIAD_ROOTS[q.answer]).toContain(q.notes[0].letter)
    }
  })

  it('expert: names a single note in octave 4; audio matches the shown label', () => {
    for (const pool of ['natural', 'some', 'all'] as const) {
      for (const q of times(150, () => makeQuestion({ mode: 'both', level: 'expert', gameType: 'ear', extended: false, earPool: pool }))) {
        expect(q.clef).toBe('treble')
        expect(q.notes).toHaveLength(1)
        expect(q.notes[0].octave).toBe(4)
        expectValidOptions(q)
        if (pool === 'natural') expect(q.answer).not.toMatch(/[♯♭]/)
        // the played pitch class must equal the answer label's pitch class
        expect(q.midis[0] % 12).toBe(PITCH_CLASS[q.answer])
      }
    }
  })
})
