export type Clef = 'treble' | 'bass' | 'alto' | 'tenor'
export const CLEFS: Clef[] = ['treble', 'bass', 'alto', 'tenor']
/** 'both' is the historical id for "random clef" (kept for stored best scores) */
export type ClefMode = Clef | 'both'
export type Level = 'easy' | 'medium' | 'hard' | 'expert'
export type GameType = 'notes' | 'intervals' | 'chords' | 'ear'
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

// Standard playable range: one ledger line above and below the staff.
// Extended range: three ledger lines each way.
const RANGES: Record<Clef, [low: [NoteLetter, number], high: [NoteLetter, number]]> = {
  treble: [['C', 4], ['A', 5]],
  bass: [['E', 2], ['C', 4]],
  alto: [['D', 3], ['B', 4]],
  tenor: [['B', 2], ['G', 4]],
}
const EXTENDED_STEPS = 4 // two extra ledger lines beyond standard, each way

function rangeOf(clef: Clef, extended: boolean): [number, number] {
  const [[lowLetter, lowOctave], [highLetter, highOctave]] = RANGES[clef]
  const pad = extended ? EXTENDED_STEPS : 0
  return [
    diatonicIndex(lowLetter, lowOctave) - pad,
    diatonicIndex(highLetter, highOctave) + pad,
  ]
}

function noteAt(clef: Clef, idx: number): Note {
  return {
    letter: LETTERS[idx % 7],
    octave: Math.floor(idx / 7),
    staffPosition: idx - BOTTOM_LINE[clef],
    clef,
  }
}

/** The note a staff position denotes in a given clef (for stats displays) */
export function noteForPosition(clef: Clef, staffPosition: number): Note {
  return noteAt(clef, BOTTOM_LINE[clef] + staffPosition)
}

// Key signatures. Glyph staff positions follow standard engraving order.
// Bass/alto are the treble positions shifted down; tenor flats shift up, but
// tenor sharps use the exceptional pattern that starts F♯ low to stay inside
// the staff.
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
  makeKey('B major', 'sharp', 5),
  makeKey('F♯ major', 'sharp', 6),
  makeKey('C♯ major', 'sharp', 7),
  makeKey('F major', 'flat', 1),
  makeKey('B♭ major', 'flat', 2),
  makeKey('E♭ major', 'flat', 3),
  makeKey('A♭ major', 'flat', 4),
  makeKey('D♭ major', 'flat', 5),
  makeKey('G♭ major', 'flat', 6),
  makeKey('C♭ major', 'flat', 7),
]

// Skip enharmonic oddities (B♯, E♯, C♭, F♭) when drawing accidentals on single
// notes — confusing for learners. They can still be correct answers in hard
// mode under 6-7 accidental key signatures, where they are musically real.
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

export const INTERVAL_NAMES = ['2nd', '3rd', '4th', '5th', '6th', '7th', 'Octave']

export interface Question {
  clef: Clef
  /** The note(s) drawn on the staff, bottom first */
  notes: Note[]
  key?: KeySignature
  /** The correct option label, e.g. "F♯", "5th" */
  answer: string
  /** Display string for feedback/summary, e.g. "F♯4", "5th", "C triad" */
  display: string
  options: string[]
  /** MIDI numbers of the effective pitches, for audio playback */
  midis: number[]
}

const SEMITONES: Record<NoteLetter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function midiOf(letter: NoteLetter, octave: number, accidental?: Accidental): number {
  const shift = accidental === 'sharp' ? 1 : accidental === 'flat' ? -1 : 0
  return (octave + 1) * 12 + SEMITONES[letter] + shift
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(low: number, high: number): number {
  return low + Math.floor(Math.random() * (high - low + 1))
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
function noteDistractors(answer: string, letter: NoteLetter, level: Level): string[] {
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

export type PositionWeight = (clef: Clef, staffPosition: number) => number

export interface QuestionOpts {
  mode: ClefMode
  level: Level
  gameType: GameType
  extended: boolean
  previous?: Question
  /** Adaptive selection: relative weight per staff position (default uniform) */
  weight?: PositionWeight
}

function weightedIndex(clef: Clef, low: number, high: number, weight?: PositionWeight): number {
  if (!weight) return randInt(low, high)
  const weights: number[] = []
  let total = 0
  for (let idx = low; idx <= high; idx++) {
    const w = Math.max(0, weight(clef, idx - BOTTOM_LINE[clef]))
    weights.push(w)
    total += w
  }
  if (total <= 0) return randInt(low, high)
  let roll = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return low + i
  }
  return high
}

function makeNotesQuestion(
  clef: Clef,
  level: Level,
  extended: boolean,
  weight?: PositionWeight,
): Question {
  const [low, high] = rangeOf(clef, extended)
  const note = noteAt(clef, weightedIndex(clef, low, high, weight))
  let key: KeySignature | undefined
  if (level === 'medium') {
    note.accidental = pickAccidental(note.letter)
  } else if (level === 'hard') {
    key = pick(KEYS)
  }

  const effectiveAccidental =
    level === 'hard' && key!.letters.includes(note.letter) ? key!.accidental : note.accidental
  const answer = noteLabel(note.letter, effectiveAccidental)
  const options = shuffle([answer, ...noteDistractors(answer, note.letter, level)])
  return {
    clef,
    notes: [note],
    key,
    answer,
    display: `${answer}${note.octave}`,
    options,
    midis: [midiOf(note.letter, note.octave, effectiveAccidental)],
  }
}

function makeIntervalQuestion(clef: Clef, extended: boolean): Question {
  const [low, high] = rangeOf(clef, extended)
  const steps = randInt(1, 7) // 2nd .. octave
  const bottomIdx = randInt(low, high - steps)
  const notes = [noteAt(clef, bottomIdx), noteAt(clef, bottomIdx + steps)]
  const answer = INTERVAL_NAMES[steps - 1]
  // Two nearest interval names plus one random other — plausible confusions
  const others = INTERVAL_NAMES.filter((n) => n !== answer)
  const nearest = others
    .slice()
    .sort(
      (a, b) =>
        Math.abs(INTERVAL_NAMES.indexOf(a) - (steps - 1)) -
        Math.abs(INTERVAL_NAMES.indexOf(b) - (steps - 1)),
    )
    .slice(0, 2)
  const rest = shuffle(others.filter((n) => !nearest.includes(n)))[0]
  return {
    clef,
    notes,
    answer,
    display: answer,
    options: shuffle([answer, ...nearest, rest]),
    midis: notes.map((n) => midiOf(n.letter, n.octave)),
  }
}

function makeChordQuestion(clef: Clef, extended: boolean): Question {
  const [low, high] = rangeOf(clef, extended)
  const rootIdx = randInt(low, high - 4)
  const notes = [0, 2, 4].map((s) => noteAt(clef, rootIdx + s))
  const answer = notes[0].letter
  const options = shuffle([
    answer,
    ...shuffle(LETTERS.filter((l) => l !== answer)).slice(0, 3),
  ])
  return {
    clef,
    notes,
    answer,
    display: `${answer} triad`,
    options,
    midis: notes.map((n) => midiOf(n.letter, n.octave)),
  }
}

// Natural (no-accidental) triad qualities are fixed by the root letter, so the
// ear-training chord level can play real qualities AND reveal a clean staff
const TRIAD_ROOTS: Record<string, NoteLetter[]> = {
  Major: ['C', 'F', 'G'],
  Minor: ['D', 'E', 'A'],
  Diminished: ['B'],
}
export const TRIAD_QUALITIES = Object.keys(TRIAD_ROOTS)

function noteName(n: Note): string {
  return `${noteLabel(n.letter, n.accidental)}${n.octave}`
}

function makeEarQuestion(clef: Clef, level: Level): Question {
  const [low, high] = rangeOf(clef, false)

  if (level === 'expert') {
    // Name a single heard note. Kept within one fixed octave (C4-B4) so pitch
    // memory can form; revealed on the treble staff.
    const idx = diatonicIndex(pick(LETTERS), 4)
    const note = noteAt('treble', idx)
    return {
      clef: 'treble',
      notes: [note],
      answer: note.letter,
      display: noteName(note),
      options: shuffle([
        note.letter,
        ...shuffle(LETTERS.filter((l) => l !== note.letter)).slice(0, 3),
      ]),
      midis: [midiOf(note.letter, note.octave)],
    }
  }

  if (level === 'easy') {
    // Two notes at least a third apart — which way did the second one go?
    const first = randInt(low, high)
    let second = randInt(low, high)
    while (Math.abs(second - first) < 2) second = randInt(low, high)
    const notes = [noteAt(clef, first), noteAt(clef, second)]
    const answer = second > first ? 'Higher ⬆️' : 'Lower ⬇️'
    return {
      clef,
      notes,
      answer,
      display: `${answer} (${noteName(notes[0])} → ${noteName(notes[1])})`,
      options: ['Higher ⬆️', 'Lower ⬇️'],
      midis: notes.map((n) => midiOf(n.letter, n.octave)),
    }
  }

  if (level === 'medium') {
    // Ascending melodic interval — same answers as the reading game
    const q = makeIntervalQuestion(clef, false)
    return {
      ...q,
      display: `${q.answer} (${noteName(q.notes[0])} → ${noteName(q.notes[1])})`,
    }
  }

  // hard: chord quality from a natural triad
  const quality = pick(TRIAD_QUALITIES)
  const rootChoices: number[] = []
  for (let idx = low; idx <= high - 4; idx++) {
    if (TRIAD_ROOTS[quality].includes(LETTERS[idx % 7])) rootChoices.push(idx)
  }
  const rootIdx = pick(rootChoices)
  const notes = [0, 2, 4].map((s) => noteAt(clef, rootIdx + s))
  return {
    clef,
    notes,
    answer: quality,
    display: `${quality} (${notes[0].letter} triad)`,
    options: [...TRIAD_QUALITIES],
    midis: notes.map((n) => midiOf(n.letter, n.octave)),
  }
}

export function makeQuestion(opts: QuestionOpts): Question {
  const { mode, level, gameType, extended, previous, weight } = opts
  for (let attempt = 0; ; attempt++) {
    // Ear training reveals on treble/bass only — the clefs beginners read
    const clef: Clef =
      gameType === 'ear'
        ? pick(['treble', 'bass'])
        : mode === 'both'
          ? pick(CLEFS)
          : mode
    const q =
      gameType === 'intervals'
        ? makeIntervalQuestion(clef, extended)
        : gameType === 'chords'
          ? makeChordQuestion(clef, extended)
          : gameType === 'ear'
            ? makeEarQuestion(clef, level)
            : makeNotesQuestion(clef, level, extended, weight)
    // Avoid repeating the previous question exactly (give up after a few tries
    // in case the pool is somehow tiny)
    const samePlace =
      previous &&
      q.clef === previous.clef &&
      q.notes[0].staffPosition === previous.notes[0].staffPosition &&
      q.display === previous.display
    if (!samePlace || attempt >= 8) return q
  }
}
