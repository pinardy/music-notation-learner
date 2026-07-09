export type Clef = 'treble' | 'bass' | 'alto' | 'tenor'
export const CLEFS: Clef[] = ['treble', 'bass', 'alto', 'tenor']
/** 'both' is the historical id for "random clef" (kept for stored best scores) */
export type ClefMode = Clef | 'both'
export type Level = 'easy' | 'medium' | 'hard'
export type Accidental = 'sharp' | 'flat'

export type NoteLetter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

export const LETTERS: NoteLetter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

export const ACCIDENTAL_GLYPH: Record<Accidental, string> = {
  sharp: '♯',
  flat: '♭',
}

export interface Note {
  letter: NoteLetter
  octave: number
  /** Diatonic steps above the staff's bottom line (line = even, space = odd) */
  staffPosition: number
  clef: Clef
  /** Accidental drawn next to the note (medium level) */
  accidental?: Accidental
}

export interface KeySignature {
  name: string
  accidental: Accidental
  /** Letters altered by this key, in signature order */
  letters: NoteLetter[]
  /** Staff positions of the signature glyphs, per clef, in signature order */
  positions: Record<Clef, number[]>
}

/** Diatonic index: C0 = 0, D0 = 1, ... one step per letter */
function diatonicIndex(letter: NoteLetter, octave: number): number {
  return octave * 7 + LETTERS.indexOf(letter)
}

// Bottom line of each staff: E4 treble, G2 bass, F3 alto, D3 tenor
const BOTTOM_LINE: Record<Clef, number> = {
  treble: diatonicIndex('E', 4),
  bass: diatonicIndex('G', 2),
  alto: diatonicIndex('F', 3),
  tenor: diatonicIndex('D', 3),
}

// Playable ranges (one ledger line above and below the staff)
const RANGES: Record<Clef, [low: [NoteLetter, number], high: [NoteLetter, number]]> = {
  treble: [['C', 4], ['A', 5]],
  bass: [['E', 2], ['C', 4]],
  alto: [['D', 3], ['B', 4]],
  tenor: [['B', 2], ['G', 4]],
}

function buildNotes(clef: Clef): Note[] {
  const [[lowLetter, lowOctave], [highLetter, highOctave]] = RANGES[clef]
  const lowIdx = diatonicIndex(lowLetter, lowOctave)
  const highIdx = diatonicIndex(highLetter, highOctave)
  const notes: Note[] = []
  for (let idx = lowIdx; idx <= highIdx; idx++) {
    notes.push({
      letter: LETTERS[idx % 7],
      octave: Math.floor(idx / 7),
      staffPosition: idx - BOTTOM_LINE[clef],
      clef,
    })
  }
  return notes
}

const NOTE_POOL = Object.fromEntries(CLEFS.map((c) => [c, buildNotes(c)])) as Record<
  Clef,
  Note[]
>

// Key signatures up to four accidentals. Glyph staff positions follow standard
// engraving order. Bass/alto are the treble positions shifted down; tenor flats
// shift up, but tenor sharps use the exceptional pattern that starts F♯ low to
// stay inside the staff.
const SHARP_ORDER: NoteLetter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER: NoteLetter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

const SHARP_POSITIONS: Record<Clef, number[]> = {
  treble: [8, 5, 9, 6, 3, 7, 4],
  bass: [6, 3, 7, 4, 1, 5, 2],
  alto: [7, 4, 8, 5, 2, 6, 3],
  tenor: [2, 6, 3, 7, 4, 8, 5],
}

const FLAT_POSITIONS: Record<Clef, number[]> = {
  treble: [4, 7, 3, 6, 2, 5, 1],
  bass: [2, 5, 1, 4, 0, 3, -1],
  alto: [3, 6, 2, 5, 1, 4, 0],
  tenor: [5, 8, 4, 7, 3, 6, 2],
}

function makeKey(name: string, accidental: Accidental, count: number): KeySignature {
  const order = accidental === 'sharp' ? SHARP_ORDER : FLAT_ORDER
  const table = accidental === 'sharp' ? SHARP_POSITIONS : FLAT_POSITIONS
  return {
    name,
    accidental,
    letters: order.slice(0, count),
    positions: Object.fromEntries(
      CLEFS.map((c) => [c, table[c].slice(0, count)]),
    ) as Record<Clef, number[]>,
  }
}

export const KEYS: KeySignature[] = [
  makeKey('G major', 'sharp', 1),
  makeKey('D major', 'sharp', 2),
  makeKey('A major', 'sharp', 3),
  makeKey('E major', 'sharp', 4),
  makeKey('F major', 'flat', 1),
  makeKey('B♭ major', 'flat', 2),
  makeKey('E♭ major', 'flat', 3),
  makeKey('A♭ major', 'flat', 4),
]

// Skip enharmonic oddities (B♯, E♯, C♭, F♭) — confusing for learners
const ALLOWED: Record<Accidental, NoteLetter[]> = {
  sharp: ['C', 'D', 'F', 'G', 'A'],
  flat: ['D', 'E', 'G', 'A', 'B'],
}

export function noteLabel(letter: NoteLetter, accidental?: Accidental): string {
  return accidental ? letter + ACCIDENTAL_GLYPH[accidental] : letter
}

const ALL_LABELS: string[] = LETTERS.flatMap((letter) => [
  noteLabel(letter),
  ...(['sharp', 'flat'] as Accidental[])
    .filter((acc) => ALLOWED[acc].includes(letter))
    .map((acc) => noteLabel(letter, acc)),
])

export interface Question {
  note: Note
  key?: KeySignature
  /** The correct label, e.g. "F♯" */
  answer: string
  options: string[]
  /** MIDI number of the effective pitch, for audio playback */
  midi: number
}

const SEMITONES: Record<NoteLetter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function midiOf(letter: NoteLetter, octave: number, accidental?: Accidental): number {
  const shift = accidental === 'sharp' ? 1 : accidental === 'flat' ? -1 : 0
  return (octave + 1) * 12 + SEMITONES[letter] + shift
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function pickAccidental(letter: NoteLetter): Accidental | undefined {
  if (Math.random() < 0.4) return undefined
  const allowed = (['sharp', 'flat'] as Accidental[]).filter((acc) =>
    ALLOWED[acc].includes(letter),
  )
  return allowed.length ? pick(allowed) : undefined
}

/** Three wrong labels: one sharing the letter, one sharing the accidental, one random */
function distractors(answer: string, letter: NoteLetter, level: Level): string[] {
  if (level === 'easy') {
    return shuffle(LETTERS.filter((l) => l !== letter)).slice(0, 3)
  }
  const accidentalOf = (label: string) => label.slice(1)
  const others = shuffle(ALL_LABELS.filter((l) => l !== answer))
  const chosen: string[] = []
  const sameLetter = others.find((o) => o[0] === letter)
  if (sameLetter) chosen.push(sameLetter)
  const sameAccidental = others.find(
    (o) => accidentalOf(o) === accidentalOf(answer) && o[0] !== letter && !chosen.includes(o),
  )
  if (sameAccidental) chosen.push(sameAccidental)
  for (const o of others) {
    if (chosen.length >= 3) break
    if (!chosen.includes(o)) chosen.push(o)
  }
  return chosen
}

export function makeQuestion(mode: ClefMode, level: Level, previous?: Note): Question {
  const clef: Clef = mode === 'both' ? pick(CLEFS) : mode

  let base = pick(NOTE_POOL[clef])
  // Avoid showing the exact same staff position twice in a row
  while (
    previous &&
    base.letter === previous.letter &&
    base.octave === previous.octave &&
    base.clef === previous.clef
  ) {
    base = pick(NOTE_POOL[clef])
  }

  let note: Note = { ...base }
  let key: KeySignature | undefined
  if (level === 'medium') {
    note.accidental = pickAccidental(note.letter)
  } else if (level === 'hard') {
    key = pick(KEYS)
  }

  const effectiveAccidental =
    level === 'hard' && key!.letters.includes(note.letter) ? key!.accidental : note.accidental
  const answer = noteLabel(note.letter, effectiveAccidental)

  const options = shuffle([answer, ...distractors(answer, note.letter, level)])
  const midi = midiOf(note.letter, note.octave, effectiveAccidental)
  return { note, key, answer, options, midi }
}
