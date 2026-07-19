import { useLayoutEffect, useRef, useState } from 'react'
import type { Accidental, Clef, KeySignature, Note } from './notes'
import { noteForPosition } from './notes'

const WIDTH = 340
const HEIGHT = 220
const LINE_GAP = 16
const STEP = LINE_GAP / 2 // one diatonic step (line -> space)
const BOTTOM_LINE_Y = HEIGHT / 2 + 2 * LINE_GAP // y of staff position 0
const NOTE_X = 225
// Center of the first key-signature glyph, relative to the clef's right edge.
// The clef is a font glyph whose width varies by platform, so the actual x is
// measured with getBBox(); this is the fallback before first measurement.
const KEY_SIG_GAP = 15
const KEY_SIG_X_FALLBACK = 105
const KEY_SIG_STEP = 14

/** y coordinate for a staff position (0 = bottom line, counting up) */
function yFor(position: number): number {
  return BOTTOM_LINE_Y - position * STEP
}

function ledgerPositions(position: number): number[] {
  const lines: number[] = []
  for (let p = -2; p >= position; p -= 2) lines.push(p) // below the staff
  for (let p = 10; p <= position; p += 2) lines.push(p) // above the staff
  return lines
}

/** A slanted beam of the sharp sign, centered vertically on yc */
function sharpBeam(yc: number): string {
  const slant = 1.6 // half the rise across the beam
  const t = 3.8 // beam thickness
  return [
    `M -6.5 ${yc + slant - t / 2}`,
    `L 6.5 ${yc - slant - t / 2}`,
    `L 6.5 ${yc - slant + t / 2}`,
    `L -6.5 ${yc + slant + t / 2}`,
    'Z',
  ].join(' ')
}

// Hand-drawn accidentals (text-font ♯/♭ glyphs render like hash marks).
// Both are centered on (0, 0) = the note's line or space.
function SharpSign() {
  return (
    <g fill="currentColor">
      <rect x={-4.6} y={-14.5} width={1.7} height={31} />
      <rect x={2.9} y={-16.5} width={1.7} height={31} />
      <path d={sharpBeam(-4.6)} />
      <path d={sharpBeam(4.6)} />
    </g>
  )
}

function FlatSign() {
  return (
    <g>
      <rect x={-4.6} y={-19} width={1.7} height={27} fill="currentColor" />
      <path
        d="M -4.6 8 C 3.5 3.5 6.2 -1 4.6 -3.8 C 3 -6.4 -1 -5.8 -4.6 -2 Z"
        fill="currentColor"
      />
      <path
        d="M -2.9 4.5 C 1.6 1.5 3 -1.5 2 -2.8 C 1 -4 -1.3 -3 -2.9 -0.8 Z"
        fill="var(--staff-bg, #fff)"
      />
    </g>
  )
}

function AccidentalGlyph({
  accidental,
  x,
  position,
}: {
  accidental: Accidental
  x: number
  position: number
}) {
  return (
    <g transform={`translate(${x} ${yFor(position)})`}>
      {accidental === 'sharp' ? <SharpSign /> : <FlatSign />}
    </g>
  )
}

// Font-glyph clefs: unicode char, anchor staff position, and hand-calibrated
// baseline offset / size (font glyphs carry no engraving metrics)
const CLEF_GLYPHS: Record<
  Note['clef'],
  { glyph: string; x: number; position: number; baseline: number; fontSize: number }
> = {
  treble: {
    glyph: '\u{1D11E}',
    x: 28,
    position: 2,
    baseline: LINE_GAP * 1.8,
    fontSize: LINE_GAP * 8,
  },
  bass: {
    glyph: '\u{1D122}',
    x: 30,
    position: 6,
    baseline: LINE_GAP * 2.5,
    fontSize: LINE_GAP * 5.6,
  },
  alto: {
    glyph: '\u{1D121}',
    x: 30,
    position: 4,
    baseline: LINE_GAP * 2.5,
    fontSize: LINE_GAP * 6.4,
  },
  tenor: {
    glyph: '\u{1D121}',
    x: 30,
    position: 6,
    baseline: LINE_GAP * 2.5,
    fontSize: LINE_GAP * 6.4,
  },
}

/**
 * Exact vertical fit for the C clef (alto/tenor). A C clef is by definition
 * exactly staff-height, vertically symmetric about its anchor line — but the
 * glyph comes from whatever system font the browser falls back to, so the
 * hand-tuned constants can be off by a few pixels per platform. Canvas
 * measureText exposes the glyph's real ink extents, from which we derive the
 * font size and baseline that make the ink span anchor ± 2 staff lines.
 */
function useCClefFit(
  clef: Clef,
  ref: React.RefObject<SVGTextElement | null>,
): { fontSize: number; y: number } | null {
  const [fit, setFit] = useState<{ fontSize: number; y: number } | null>(null)

  useLayoutEffect(() => {
    if (clef !== 'alto' && clef !== 'tenor') {
      setFit(null)
      return
    }
    const el = ref.current
    if (!el) return
    try {
      const spec = CLEF_GLYPHS[clef]
      const ctx = document.createElement('canvas').getContext('2d')
      if (!ctx) return
      ctx.font = `${spec.fontSize}px ${getComputedStyle(el).fontFamily}`
      const m = ctx.measureText(spec.glyph)
      const inkHeight = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
      if (!inkHeight || !Number.isFinite(inkHeight)) return
      const scale = (4 * LINE_GAP) / inkHeight
      const anchorY = yFor(spec.position)
      setFit({
        fontSize: spec.fontSize * scale,
        // Baseline so the ink's vertical center lands on the anchor line
        y:
          anchorY +
          ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) * scale) / 2,
      })
    } catch {
      // Older browsers without ink metrics keep the hand-tuned constants
    }
  }, [clef, ref])

  return fit
}

interface StaffProps {
  /** Notes to draw at the note column, bottom first */
  notes: Note[]
  keySignature?: KeySignature
}

export function Staff({ notes, keySignature }: StaffProps) {
  const clef = notes[0].clef
  const clefRef = useRef<SVGTextElement>(null)
  const [keySigX, setKeySigX] = useState(KEY_SIG_X_FALLBACK)
  const cClefFit = useCClefFit(clef, clefRef)

  // Start the key signature just right of the clef's actual rendered edge
  // (re-measured after the C-clef fit adjusts the glyph size)
  useLayoutEffect(() => {
    const bbox = clefRef.current?.getBBox()
    if (bbox && bbox.width > 0) setKeySigX(bbox.x + bbox.width + KEY_SIG_GAP)
  }, [clef, cClefFit])

  // Stacked seconds collide, so the upper note shifts right (standard notation)
  const sorted = [...notes].sort((a, b) => a.staffPosition - b.staffPosition)
  const xOf = (i: number) =>
    i > 0 && sorted[i].staffPosition - sorted[i - 1].staffPosition === 1
      ? NOTE_X + 17
      : NOTE_X
  const anyOffset = sorted.some((_, i) => xOf(i) !== NOTE_X)

  // Merge the ledger lines every drawn note needs
  const ledgers = [...new Set(sorted.flatMap((n) => ledgerPositions(n.staffPosition)))]

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="staff"
      role="img"
      aria-label={`${notes.length > 1 ? 'Notes' : 'A note'} on the ${clef} clef staff`}
    >
      {/* Staff lines (positions 0, 2, 4, 6, 8) */}
      {[0, 2, 4, 6, 8].map((p) => (
        <line
          key={p}
          x1={20}
          x2={WIDTH - 20}
          y1={yFor(p)}
          y2={yFor(p)}
          stroke="currentColor"
          strokeWidth={1.5}
        />
      ))}

      {/* Clef glyph, anchored to its reference line: G4 (treble), F3 (bass),
          or the middle-C line of the C clef (alto: line 3, tenor: line 4) */}
      <text
        ref={clefRef}
        x={CLEF_GLYPHS[clef].x}
        y={cClefFit?.y ?? yFor(CLEF_GLYPHS[clef].position) + CLEF_GLYPHS[clef].baseline}
        fontSize={cClefFit?.fontSize ?? CLEF_GLYPHS[clef].fontSize}
        fill="currentColor"
      >
        {CLEF_GLYPHS[clef].glyph}
      </text>

      {/* Key signature */}
      {keySignature?.positions[clef].map((position, i) => (
        <AccidentalGlyph
          key={i}
          accidental={keySignature.accidental}
          x={keySigX + i * KEY_SIG_STEP}
          position={position}
        />
      ))}

      {/* Ledger lines (widened when a stacked second shifts a note right) */}
      {ledgers.map((p) => (
        <line
          key={p}
          x1={NOTE_X - 18}
          x2={NOTE_X + 18 + (anyOffset ? 17 : 0)}
          y1={yFor(p)}
          y2={yFor(p)}
          stroke="currentColor"
          strokeWidth={1.5}
        />
      ))}

      {/* Accidentals in front of their notes */}
      {sorted.map(
        (n, i) =>
          n.accidental && (
            <AccidentalGlyph
              key={`acc-${i}`}
              accidental={n.accidental}
              x={NOTE_X - 28}
              position={n.staffPosition}
            />
          ),
      )}

      {/* Whole notes */}
      {sorted.map((n, i) => (
        <g key={i} transform={`translate(${xOf(i)} ${yFor(n.staffPosition)})`}>
          <ellipse rx={9.5} ry={6.5} fill="currentColor" transform="rotate(-14)" />
          <ellipse rx={5.2} ry={3.4} fill="var(--staff-bg, #fff)" transform="rotate(-32)" />
        </g>
      ))}
    </svg>
  )
}

// --- Stats heatmap staff ---

export interface HeatCell {
  position: number
  /** 0..1 fraction of correct answers */
  accuracy: number
  attempts: number
}

function heatColor(accuracy: number): string {
  if (accuracy >= 0.8) return '#35c46f'
  if (accuracy >= 0.5) return '#ffb347'
  return '#ff6b81'
}

/**
 * Every practiced staff position drawn as an ascending run, each notehead
 * colored by the player's accuracy on that position.
 */
export function HeatStaff({ clef, cells }: { clef: Clef; cells: HeatCell[] }) {
  const clefRef = useRef<SVGTextElement>(null)
  const cClefFit = useCClefFit(clef, clefRef)
  const sorted = [...cells].sort((a, b) => a.position - b.position)
  const startX = 78
  const stepX = 30
  const width = Math.max(WIDTH, startX + sorted.length * stepX + 24)

  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT}`}
      className="staff"
      role="img"
      aria-label={`Accuracy per note on the ${clef} clef staff`}
    >
      {[0, 2, 4, 6, 8].map((p) => (
        <line
          key={p}
          x1={20}
          x2={width - 12}
          y1={yFor(p)}
          y2={yFor(p)}
          stroke="currentColor"
          strokeWidth={1.5}
        />
      ))}

      <text
        ref={clefRef}
        x={CLEF_GLYPHS[clef].x}
        y={cClefFit?.y ?? yFor(CLEF_GLYPHS[clef].position) + CLEF_GLYPHS[clef].baseline}
        fontSize={cClefFit?.fontSize ?? CLEF_GLYPHS[clef].fontSize}
        fill="currentColor"
      >
        {CLEF_GLYPHS[clef].glyph}
      </text>

      {sorted.map((cell, i) => {
        const x = startX + i * stepX + stepX / 2
        const note = noteForPosition(clef, cell.position)
        return (
          <g key={cell.position}>
            {ledgerPositions(cell.position).map((p) => (
              <line
                key={p}
                x1={x - 15}
                x2={x + 15}
                y1={yFor(p)}
                y2={yFor(p)}
                stroke="currentColor"
                strokeWidth={1.5}
              />
            ))}
            <g transform={`translate(${x} ${yFor(cell.position)})`}>
              <ellipse rx={9.5} ry={6.5} fill={heatColor(cell.accuracy)} transform="rotate(-14)" />
              <ellipse rx={4.6} ry={3} fill="var(--staff-bg, #fff)" transform="rotate(-32)" />
            </g>
            <text
              x={x}
              y={HEIGHT - 6}
              textAnchor="middle"
              fontSize={13}
              fontFamily="inherit"
              fill="currentColor"
            >
              {note.letter}
              {note.octave}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// --- Sight reading sequence staff ---

interface SequenceStaffProps {
  clef: Clef
  keySignature?: KeySignature
  notes: Note[]
  /** Index of the note to play next; earlier notes render as done */
  cursor: number
  /** Flash the cursor note red after a wrong attempt */
  wrong?: boolean
}

/**
 * A left-to-right line of notes with a play cursor: done notes green, the
 * current target purple (red while a wrong attempt flashes), upcoming ink.
 */
export function SequenceStaff({ clef, keySignature, notes, cursor, wrong }: SequenceStaffProps) {
  const clefRef = useRef<SVGTextElement>(null)
  const cClefFit = useCClefFit(clef, clefRef)
  const [keySigX, setKeySigX] = useState(KEY_SIG_X_FALLBACK)

  useLayoutEffect(() => {
    const bbox = clefRef.current?.getBBox()
    if (bbox && bbox.width > 0) setKeySigX(bbox.x + bbox.width + KEY_SIG_GAP)
  }, [clef, cClefFit])

  const sigCount = keySignature?.letters.length ?? 0
  const startX = keySigX + sigCount * KEY_SIG_STEP + 14
  const stepX = 42 // room for an accidental in front of each note
  const width = startX + notes.length * stepX + 16

  const colorFor = (i: number) =>
    i < cursor
      ? 'var(--happy-green)'
      : i === cursor
        ? wrong
          ? 'var(--candy-red)'
          : 'var(--accent)'
        : 'currentColor'

  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT}`}
      className="staff"
      role="img"
      aria-label={`A line of ${notes.length} notes on the ${clef} clef staff`}
    >
      {[0, 2, 4, 6, 8].map((p) => (
        <line
          key={p}
          x1={20}
          x2={width - 10}
          y1={yFor(p)}
          y2={yFor(p)}
          stroke="currentColor"
          strokeWidth={1.5}
        />
      ))}

      <text
        ref={clefRef}
        x={CLEF_GLYPHS[clef].x}
        y={cClefFit?.y ?? yFor(CLEF_GLYPHS[clef].position) + CLEF_GLYPHS[clef].baseline}
        fontSize={cClefFit?.fontSize ?? CLEF_GLYPHS[clef].fontSize}
        fill="currentColor"
      >
        {CLEF_GLYPHS[clef].glyph}
      </text>

      {keySignature?.positions[clef].map((position, i) => (
        <AccidentalGlyph
          key={i}
          accidental={keySignature.accidental}
          x={keySigX + i * KEY_SIG_STEP}
          position={position}
        />
      ))}

      {notes.map((n, i) => {
        const x = startX + i * stepX + stepX / 2
        return (
          <g key={i} style={{ color: colorFor(i) }}>
            {ledgerPositions(n.staffPosition).map((p) => (
              <line
                key={p}
                x1={x - 15}
                x2={x + 15}
                y1={yFor(p)}
                y2={yFor(p)}
                stroke="currentColor"
                strokeWidth={1.5}
              />
            ))}
            {n.accidental && (
              <AccidentalGlyph accidental={n.accidental} x={x - 17} position={n.staffPosition} />
            )}
            <g transform={`translate(${x} ${yFor(n.staffPosition)})`}>
              <ellipse rx={9.5} ry={6.5} fill="currentColor" transform="rotate(-14)" />
              <ellipse rx={5.2} ry={3.4} fill="var(--staff-bg, #fff)" transform="rotate(-32)" />
            </g>
            {i === cursor && (
              <path
                d={`M ${x - 6} ${HEIGHT - 12} L ${x + 6} ${HEIGHT - 12} L ${x} ${HEIGHT - 22} Z`}
                fill="currentColor"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}
