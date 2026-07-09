# Note Reading Trainer

A game for learning to read music notation, built with React + TypeScript + Vite.

<img src="https://pinardy.github.io/music-notation-learner/screenshot.png" width="480" alt="A treble clef staff showing a whole note, with four colorful answer buttons below">

A note is shown on a staff and you pick its name from four options. Each round
is 10 questions; your score and per-question response time are recorded, and
your best result per mode is saved in the browser (localStorage).

Correct answers play the pitch(es), synthesized with the Web Audio API
(toggle with the 🔊 button).

## Games

- **Notes** — name the note on the staff (difficulty levels below)
- **Intervals** — two stacked notes; name the distance (2nd through octave)
- **Chords** — a root-position triad; name the root note
- **Ear Training** — the app plays, you identify by ear, and the staff is
  revealed after answering: higher-or-lower (easy), interval distance
  (medium), or chord quality — major/minor/diminished natural triads (hard)

An **extended range** toggle widens every game from one ledger line to three
ledger lines above and below the staff.

A **stats screen** (📊 My Stats) aggregates your play history (stored locally,
last 300 rounds): accuracy per game type, every practiced note drawn on a
staff colored by accuracy, and a "practice these" list of your weakest notes.

**Smart practice** (🧠, on by default for the Notes game) adaptively weights
question selection using that history: notes you miss often or answer slowly
come up more, unseen notes get a small boost, and mastered notes appear less.

## Modes

- **Treble clef** — C4 to A5 (one ledger line above/below the staff)
- **Bass clef** — E2 to C4
- **Alto clef** — D3 to B4 (C clef on the middle line)
- **Tenor clef** — B2 to G4 (C clef on the fourth line, with the standard
  low-starting sharp key signature pattern)
- **All clefs** — random clef per question

## Levels

- **Easy** — natural notes only
- **Medium** — notes may carry a ♯ or ♭ accidental; answers include the
  accidental (enharmonic oddities like B♯/C♭ are excluded)
- **Hard** — a key signature (up to 7 sharps or flats, all major keys from
  C♭ to C♯) is drawn on the staff; name the effective pitch of the plain
  note, e.g. an F in D major is F♯

## Development

```sh
npm install
npm run dev      # start dev server at http://localhost:5173
npm run build    # type-check and build for production
```

## Code layout

- `src/notes.ts` — note model, staff-position math, question generation
- `src/Staff.tsx` — SVG rendering of the staff, clef, ledger lines, and note
- `src/App.tsx` — game screens (start / playing / summary), scoring, timing
