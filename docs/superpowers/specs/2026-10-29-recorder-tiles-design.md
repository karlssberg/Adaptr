# Recorder Tiles — Design

Date: 2026-10-29

## Intent

A rhythm game for practising the recorder. Notes fall down the screen in the
style of *Magic Tiles 3*; the player plays each note at the moment its tile
reaches the hit line. The computer judges the performance: a wrong note, a
mistimed note, or a note let go too early ends the game. Players can write
their own songs in a simple editor.

## Goals

- Two input modes sharing the same songs, timing rules and lose rules:
  - **Recorder mode** — a real soprano (descant) recorder played into the
    computer's microphone; the game detects pitch and note onset.
  - **Keyboard mode** — computer keys stand in for recorder notes.
- Magic Tiles–style play: one vertical lane per note used by the song, tiles
  fall toward a hit line, long tiles must be held.
- Strict, unforgiving judging: the first mistake loses.
- A simple song editor to create, preview, save and play songs.
- A few built-in beginner songs.

## Non-goals (for now)

- Sharing songs between players/devices.
- Touch-screen / tablet support (desktop or laptop browser assumed).
- Scores, combos, lives, leaderboards — a run is simply won or lost.
- Instruments other than a soprano recorder.
- Importing MIDI or sheet music.

## Anti-goals

- Recorder mode that loses the player on notes they actually played
  correctly (false failures from detection latency or noise). If detection
  can't be trusted, the mode is a failure even though it "works".
- Keyboard and recorder modes drifting into different rule sets.

## Constraints

- Runs in a modern desktop browser, no install.
- TypeScript (user's choice).
- Only libraries whose APIs are documented. Pitch detection: `pitchy`
  (v4, ESM-only, McLeod Pitch Method; `PitchDetector.forFloat32Array(n)` and
  `findPitch(input, sampleRate)` → `[pitchHz, clarity]`). Audio via the
  browser's Web Audio API (`getUserMedia`, `AnalyserNode`, oscillators for
  preview sound).
- Microphone access requires a secure context (localhost or HTTPS) and a
  user gesture to start audio.
- Lives in this repository (`karlssberg/adaptr`), which is currently empty.

## Approaches considered

1. **Plain TypeScript web app, no game engine** — *chosen.* Canvas for the
   falling tiles, ordinary HTML for menus and the editor, Web Audio + `pitchy`
   for listening. Least machinery; the game is lanes, tiles and timing.
2. Web app on a game engine (e.g. Phaser) — ready-made rendering/scenes, but
   mostly unused, and editor UI is awkward inside an engine.
3. C# desktop app (e.g. Unity) — more polish possible, but needs an install
   and is heavy for this size of game.

The user picked option 1.

## Decided behaviour

### Game screen

- One lane per distinct note in the current song, ordered low to high pitch,
  each labelled with its note name (e.g. G, A, B).
- Tiles fall at a constant speed toward a hit line near the bottom. A tile's
  length is proportional to its note duration.
- Keyboard mode: each lane has a key, shown on the lane label.
  *(Builder's call: which keys — e.g. home-row keys left to right.)*

### Judging (both modes)

- A note must **start** within a timing window around the moment its tile
  reaches the hit line. Too early, too late, or never → lose.
- Playing a note whose lane has no tile due → lose (wrong note).
- A note must be **held** for the tile's length. Stopping or changing before
  the tile ends → lose, except for a small **end allowance** (time to breathe
  or move fingers) just before the tile's end. *(Proposal accepted.)*
- Holding past the tile's end is fine, until the next tile is due; still
  sounding the old note when the next note is due counts as a wrong note.
  *(Proposal accepted.)*
- **Recorder mode uses a wider start window** than keyboard mode, to cover
  detection delay. *(Proposal accepted.)* Exact window and allowance values
  are tuning constants left to the builder, set by testing with a real
  recorder.
- **Repeated notes must be re-attacked.** Two tiles of the same note in a row
  are two notes: in keyboard mode the key must be released and pressed again;
  in recorder mode the player must tongue a fresh attack (a short dip and
  rise in volume). Simply holding through counts as missing the second note
  (too late). The detector therefore tracks attacks (volume envelope), not
  only steady pitch, and must not treat a brief mid-note wobble as a new
  attack. *(Claude's call — matches real recorder technique and the strict
  rules; flag if too harsh in testing.)*
- Reaching the end of the song without a mistake → win.
- On losing, the game shows what went wrong (wrong note / too early / too
  late / let go too early) and offers to retry.

### Recorder mode

- Detects pitch from the microphone and maps it to the nearest recorder note
  in the soprano range (sounding C5–D7).
- Ignores readings below a clarity/volume threshold (silence, noise).
- A note counts as "started" once the same pitch has been detected steadily
  for a short time; that start time is what the timing window checks.
  *(Builder's call: thresholds and steadiness time, chosen by testing.)*
- Tolerates slightly out-of-tune playing (nearest-semitone matching).
- A short calibration/test screen ("play a note, see what the game hears")
  is recommended so the player can check the mic before playing.
  *(Builder's call.)*

### Song editor

- A grid: columns are recorder notes, rows are time steps. Click to add a
  note; drag to lengthen it into a hold tile; click again to remove.
- Song name and speed (tempo) settings.
- **Preview** plays the song with a simple recorder-like synthesised sound.
- **Try it** starts the game with the song.
- Songs are saved in the browser (local storage) and listed alongside the
  built-in songs. Built-in songs can't be overwritten.
- Range: soprano recorder notes only, all half-steps (sharps used for
  naming, e.g. F#). Notes are **labelled as written** (what the player reads,
  C4–D6), not as sounding (C5–D7); the detector converts. Lane labels include
  the octave when a song uses the same letter in two octaves (e.g. D4 and
  D5). *(Claude's call.)*
- Keyboard mode needs a key per lane; songs can use more lanes than the home
  row has keys, so the mapping must scale (builder picks a key row layout).
- One note at a time (the recorder is monophonic) — the editor prevents
  overlapping notes.

### Built-in songs

A few beginner songs using few notes (e.g. *Hot Cross Buns*, *Mary Had a
Little Lamb*), typed in by the builder.

## Testing recorder mode

The user will play recorder mode but will **not** take part in tuning
sessions or supply recordings. So:

- Detection and judging are tested automatically with **synthesised
  recorder-like audio** (generated tones with attack, breath noise, slight
  detuning, tongued repeats and silence gaps) fed through the same pipeline
  as the microphone.
- The mic check screen shows the detected note live, so the player can see
  whether the game hears them correctly before playing.
- Detection thresholds and timing windows live in one settings object so
  they can be adjusted quickly if real playing exposes problems.
- Known risk: synthetic audio is not a real recorder in a real room; some
  tuning after the user first plays is likely.

## Left to the builder

- Project tooling (bundler, test runner) and file layout.
- Visual style.
- Song data format (must support note, start, duration, tempo, name).
- Timing constants, detection thresholds, keyboard key mapping.
- Grid resolution in the editor (e.g. eighth-note steps).
