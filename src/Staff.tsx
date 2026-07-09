import { useLayoutEffect, useRef, useState } from 'react'
import type { Accidental, KeySignature, Note } from './notes'

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

interface StaffProps {
  note: Note
  keySignature?: KeySignature
}

export function Staff({ note, keySignature }: StaffProps) {
  const noteY = yFor(note.staffPosition)
  const clefRef = useRef<SVGTextElement>(null)
  const [keySigX, setKeySigX] = useState(KEY_SIG_X_FALLBACK)

  // Start the key signature just right of the clef's actual rendered edge
  useLayoutEffect(() => {
    const bbox = clefRef.current?.getBBox()
    if (bbox && bbox.width > 0) setKeySigX(bbox.x + bbox.width + KEY_SIG_GAP)
  }, [note.clef])

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="staff"
      role="img"
      aria-label={`A note on the ${note.clef} clef staff`}
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

      {/* Clef glyph, anchored to its reference line (G4 for treble, F3 for bass) */}
      {note.clef === 'treble' ? (
        <text
          ref={clefRef}
          x={28}
          y={yFor(2) + LINE_GAP * 1.8}
          fontSize={LINE_GAP * 8}
          fill="currentColor"
        >
          {'\u{1D11E}'}
        </text>
      ) : (
        <text
          ref={clefRef}
          x={30}
          y={yFor(6) + LINE_GAP * 2.5}
          fontSize={LINE_GAP * 5.6}
          fill="currentColor"
        >
          {'\u{1D122}'}
        </text>
      )}

      {/* Key signature */}
      {keySignature?.positions[note.clef].map((position, i) => (
        <AccidentalGlyph
          key={i}
          accidental={keySignature.accidental}
          x={keySigX + i * KEY_SIG_STEP}
          position={position}
        />
      ))}

      {/* Ledger lines */}
      {ledgerPositions(note.staffPosition).map((p) => (
        <line
          key={p}
          x1={NOTE_X - 18}
          x2={NOTE_X + 18}
          y1={yFor(p)}
          y2={yFor(p)}
          stroke="currentColor"
          strokeWidth={1.5}
        />
      ))}

      {/* Accidental in front of the note */}
      {note.accidental && (
        <AccidentalGlyph
          accidental={note.accidental}
          x={NOTE_X - 28}
          position={note.staffPosition}
        />
      )}

      {/* Whole note */}
      <g transform={`translate(${NOTE_X} ${noteY})`}>
        <ellipse rx={9.5} ry={6.5} fill="currentColor" transform="rotate(-14)" />
        <ellipse rx={5.2} ry={3.4} fill="var(--staff-bg, #fff)" transform="rotate(-32)" />
      </g>
    </svg>
  )
}
