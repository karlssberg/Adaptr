# Recorder Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser rhythm game where tiles fall Magic Tiles–style and the player plays them on a real recorder (microphone) or the keyboard, with strict first-mistake-loses judging, scoring, and a song editor.

**Architecture:** Pure, unit-tested TypeScript core (note model, song model, judge, scoring, note tracker, editor model, storage) with thin browser glue (Web Audio mic + synth, canvas game screen, HTML menus/editor). Both input modes produce the same `noteOn`/`noteOff` events into one `Judge`, so the rules can't drift apart.

**Tech Stack:** TypeScript, Vite (vanilla-ts template), Vitest (node environment), `pitchy` 4.x for pitch detection, Web Audio API, Canvas 2D, `localStorage`, Playwright (pre-installed) for one smoke test.

**Spec:** `docs/superpowers/specs/2026-10-29-recorder-tiles-design.md`

## Global Constraints

- Runs in a modern desktop browser, no install; served over localhost/HTTPS (mic needs a secure context and a user gesture before audio starts).
- Only documented library APIs. `pitchy`: `PitchDetector.forFloat32Array(n)`, `detector.findPitch(input, sampleRate) → [pitchHz, clarity]`; ESM-only.
- Soprano recorder only. Notes are **written** pitch, sharps only, `C4`–`D6` (27 notes); sounding pitch is one octave higher (C5–D7).
- Monophonic: one note at a time, everywhere.
- First mistake ends the run. Loss reasons: `wrong-note`, `too-early`, `too-late`, `released-early`.
- Repeated same note must be re-attacked (key re-press / tongued attack).
- All tuning values live in `src/game/settings.ts` (judging/scoring) and `src/audio/trackerSettings.ts` (detection).
- Every `localStorage` access is wrapped in try/catch; the app must work without it.
- No song sharing, no touch support, no lives, no online leaderboards.

## Review Focus

1. **Same note twice, held through** — the second tile must lose `too-late` in both modes (Task 3 judge test, Task 7 tracker test).
2. **Microphone denied or missing** — recorder mode shows a plain message and returns to the menu; keyboard mode unaffected (Task 8 test).
3. **`localStorage` throws or holds corrupt JSON / invalid songs** — app still lists built-in songs; invalid user songs are skipped (Task 5 tests).
4. **Tab hidden mid-song** — the run is abandoned (no loss, no score saved), not judged `too-late` on return (Task 9 test).
5. **Key auto-repeat and unmapped keys** — `event.repeat` and keys with no lane are ignored, never a `wrong-note` (Task 6 test).

---

## File Structure

```
index.html
src/main.ts                    app router (menu / mic check / game / results / editor)
src/style.css
src/music/notes.ts             note names, MIDI, frequencies, nearest-note
src/songs/song.ts              Song types, validation, lanes, labels, timing
src/songs/builtins.ts          built-in songs
src/songs/storage.ts           user songs + best scores in localStorage
src/game/settings.ts           judging + scoring constants per mode
src/game/judge.ts              rule engine (pure)
src/game/scoring.ts            ratings, points, results (pure)
src/game/session.ts            judge + clock + visibility (pure-ish)
src/input/keyboard.ts          lane↔key mapping + listener
src/audio/trackerSettings.ts   detection constants
src/audio/noteTracker.ts       frames → noteOn/noteOff (pure)
src/audio/synthetic.ts         synthetic recorder audio for tests (pure)
src/audio/mic.ts               getUserMedia + pitchy → NoteTracker
src/audio/player.ts            preview playback (Web Audio oscillators)
src/ui/gameScreen.ts           canvas rendering + loop
src/ui/resultsScreen.ts
src/ui/menuScreen.ts
src/ui/micCheckScreen.ts
src/editor/editorModel.ts      grid operations (pure)
src/ui/editorScreen.ts
tests/*.test.ts                one per pure module
e2e/smoke.mjs                  Playwright smoke
```

---

### Task 1: Scaffold and note model

**Files:**
- Create: project via `npm create vite@latest . -- --template vanilla-ts` (keep `index.html`, `src/main.ts`, `src/style.css`; delete the counter demo), `vitest.config.ts`, `src/music/notes.ts`
- Test: `tests/notes.test.ts`

**Interfaces:**
- Produces:
  - `type NoteName = string` (e.g. `"C4"`, `"F#5"`)
  - `const RECORDER_NOTES: readonly NoteName[]` — C4…D6 ascending, 27 entries
  - `noteToMidi(n: NoteName): number` (written; C4 = 60)
  - `midiToNote(m: number): NoteName`
  - `soundingFrequency(n: NoteName): number` — Hz of written midi + 12, A4 = 440
  - `frequencyToNote(hz: number): { note: NoteName; cents: number } | null` — nearest semitone of sounding pitch, converted to written; `null` outside `RECORDER_NOTES`
  - `letterOf(n: NoteName): string` (`"F#5"` → `"F#"`)

- [ ] **Step 1: Scaffold.** Run the Vite command above, `npm i pitchy`, `npm i -D vitest`. Add `"test": "vitest run"` to `package.json`. `vitest.config.ts` uses `environment: 'node'`, `include: ['tests/**/*.test.ts']`.
- [ ] **Step 2: Write failing tests**

```ts
expect(RECORDER_NOTES).toHaveLength(27);
expect(RECORDER_NOTES[0]).toBe('C4'); expect(RECORDER_NOTES.at(-1)).toBe('D6');
expect(noteToMidi('C4')).toBe(60); expect(midiToNote(61)).toBe('C#4');
expect(soundingFrequency('A4')).toBeCloseTo(880, 3);
expect(frequencyToNote(880)).toEqual({ note: 'A4', cents: 0 });
expect(frequencyToNote(880 * 2 ** (30 / 1200))!.note).toBe('A4');   // 30 cents sharp
expect(frequencyToNote(440)).toBeNull();                             // below range
expect(letterOf('F#5')).toBe('F#');
```

- [ ] **Step 3: Run** `npm test` — Expected: FAIL (module missing).
- [ ] **Step 4: Implement `src/music/notes.ts`.**
- [ ] **Step 5: Run** `npm test` and `npx tsc --noEmit` — Expected: PASS, no type errors. `npm run build` succeeds.
- [ ] **Step 6: Commit** `feat: scaffold project and note model`

---

### Task 2: Song model and built-in songs

**Files:**
- Create: `src/songs/song.ts`, `src/songs/builtins.ts`
- Test: `tests/song.test.ts`

**Interfaces:**
- Consumes: Task 1 note functions.
- Produces:
  - `interface SongNote { note: NoteName; startBeat: number; beats: number }`
  - `interface Song { id: string; name: string; bpm: number; notes: SongNote[]; builtIn?: boolean }`
  - `interface TimedNote { index: number; note: NoteName; startMs: number; endMs: number }`
  - `validateSong(s: unknown): s is Song` — rejects: missing fields, `bpm` outside 30–240, notes outside `RECORDER_NOTES`, `beats <= 0`, overlapping notes, empty `notes`
  - `toTimedNotes(s: Song): TimedNote[]` — sorted by start; `ms = beat * 60000 / bpm`
  - `laneNotes(s: Song): NoteName[]` — distinct notes, low→high
  - `laneLabels(lanes: NoteName[]): string[]` — letter only, plus octave digit when another lane shares the letter
  - `BUILTIN_SONGS: Song[]` — `hot-cross-buns` (B4 A4 G4) and `mary-had-a-little-lamb` (B4 A4 G4 D5), `builtIn: true`, bpm 90

- [ ] **Step 1: Write failing tests**

```ts
const s: Song = { id: 'x', name: 'x', bpm: 60, notes: [
  { note: 'G4', startBeat: 0, beats: 1 }, { note: 'B4', startBeat: 1, beats: 2 }] };
expect(toTimedNotes(s)[1]).toEqual({ index: 1, note: 'B4', startMs: 1000, endMs: 3000 });
expect(laneNotes(s)).toEqual(['G4', 'B4']);
expect(laneLabels(['D4', 'G4', 'D5'])).toEqual(['D4', 'G', 'D5']);
expect(validateSong(s)).toBe(true);
expect(validateSong({ ...s, notes: [...s.notes, { note: 'A4', startBeat: 2, beats: 1 }] })).toBe(false); // overlap
expect(validateSong({ ...s, notes: [{ note: 'C7', startBeat: 0, beats: 1 }] })).toBe(false);
expect(validateSong({ ...s, notes: [] })).toBe(false);
expect(validateSong('nonsense')).toBe(false);
for (const b of BUILTIN_SONGS) expect(validateSong(b)).toBe(true);
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement both files.** Type in the two songs by ear-standard melodies (Hot Cross Buns: B A G – | B A G – | G G G G A A A A | B A G –; Mary: B A G A B B B– A A A– B D D– …).
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: song model and built-in songs`

---

### Task 3: Settings and judge

**Files:**
- Create: `src/game/settings.ts`, `src/game/judge.ts`
- Test: `tests/judge.test.ts`

**Interfaces:**
- Consumes: `TimedNote`.
- Produces:
  - `type Mode = 'keyboard' | 'recorder'`
  - `interface ModeSettings { startWindowMs: number; endAllowanceMs: number }`
  - `const SETTINGS: Record<Mode, ModeSettings>` — keyboard `{150, 150}`, recorder `{250, 200}`
  - `type LossReason = 'wrong-note' | 'too-early' | 'too-late' | 'released-early'`
  - `interface Hit { index: number; offsetMs: number; fullHold: boolean }`
  - `type JudgeStatus = 'playing' | 'won' | 'lost'`
  - `class Judge { constructor(tiles: TimedNote[], s: ModeSettings); noteOn(note: NoteName, t: number): void; noteOff(t: number): void; tick(t: number): void; readonly status: JudgeStatus; readonly loss?: { reason: LossReason; index: number; atMs: number }; readonly hits: Hit[] }` — all methods no-ops once not `playing`.

Rules (from spec), with `next` = first un-hit tile, `W` = `startWindowMs`, `A` = `endAllowanceMs`:
- `noteOn(n,t)`: an implicit `noteOff(t)` first if something is sounding. If `n !== next.note` → `wrong-note`. Else if `t < next.startMs - W` → `too-early`. Else if `t > next.startMs + W` → `too-late`. Else record hit (`offsetMs = t - next.startMs`), now holding it.
- `noteOff(t)` while holding tile `k` before its end: `t < endMs - A` → `released-early`; otherwise tile complete, `fullHold = t >= endMs`.
- `tick(t)`: holding tile `k` and `t >= k.endMs` → mark `fullHold`, keep sounding (overhang allowed). Un-hit `next` and `t > next.startMs + W` → if still sounding the previous tile's note: `too-late` when same note, `wrong-note` when different; else `too-late`. All tiles hit and last one complete (released or `t >= endMs`) → `won`.

- [ ] **Step 1: Write failing tests** (tiles: G4 0–1000, A4 1000–2000, A4 2000–3000; keyboard settings)

```ts
test('clean run wins with full holds')            // on/off at exact times → status 'won', 3 hits, all fullHold
test('wrong note loses')                          // noteOn('B4', 0) → lost, reason 'wrong-note', index 0
test('too early / too late')                      // noteOn('G4', -151) → 'too-early'; tick(151) with nothing → 'too-late'
test('edge of window is a hit')                   // noteOn('G4', 150) → playing, hits[0].offsetMs === 150
test('release before allowance loses')            // G4 on 0, off 849 → 'released-early'; off 850 → ok, fullHold false
test('holding past end is fine')                  // G4 on 0, tick(1100), noteOn('A4', 1100) → playing
test('holding through a repeated note loses')     // …A4 on 1000, never off, tick(2151) → 'too-late', index 2
test('still sounding a different note loses wrong-note') // G4 held, tick(1151) → 'wrong-note', index 1
test('noteOn after game over is ignored')
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: judge with strict timing rules`

---

### Task 4: Scoring

**Files:**
- Create: `src/game/scoring.ts`; Modify: `src/game/settings.ts`
- Test: `tests/scoring.test.ts`

**Interfaces:**
- Consumes: `Hit`, `TimedNote`, `ModeSettings`.
- Produces:
  - Add to settings: `SCORING = { perfectFrac: 0.35, greatFrac: 0.7, points: { perfect: 300, great: 200, good: 100 }, comboStep: 10, comboCap: 100, holdBonus: 50, holdTileMinMs: 400 }`
  - `type Rating = 'perfect' | 'great' | 'good'`
  - `rate(offsetMs: number, s: ModeSettings): Rating` — `|offset| <= W*perfectFrac` perfect, `<= W*greatFrac` great, else good
  - `interface Results { score: number; counts: Record<Rating, number>; accuracy: number; progress: number; won: boolean }`
  - `computeResults(tiles: TimedNote[], hits: Hit[], won: boolean, s: ModeSettings): Results` — score = Σ points + combo bonus (`min((combo-1)*comboStep, comboCap)` per Perfect where combo = consecutive Perfects) + `holdBonus` for each `fullHold` tile of length ≥ `holdTileMinMs`. `accuracy` = `100 * Σ(1, 0.66, 0.33) / tiles.length`, `progress` = `100 * hits.length / tiles.length`. Bands scale with the mode window, so recorder mode isn't penalised for its wider window.

- [ ] **Step 1: Write failing tests**

```ts
expect(rate(52, SETTINGS.keyboard)).toBe('perfect');  // 150*0.35 = 52.5
expect(rate(-53, SETTINGS.keyboard)).toBe('great');
expect(rate(106, SETTINGS.keyboard)).toBe('good');
expect(rate(87, SETTINGS.recorder)).toBe('perfect');  // 250*0.35 = 87.5
// three perfects, all full holds on 1000ms tiles: 3*300 + (0+10+20) + 3*50 = 1080
expect(computeResults(tiles, perfectHits, true, SETTINGS.keyboard).score).toBe(1080);
// lost after 1 of 3 hits
expect(computeResults(tiles, [perfectHits[0]], false, SETTINGS.keyboard)).toMatchObject({ progress: 100 / 3, won: false });
```

- [ ] **Step 2–4:** run (FAIL) → implement → run (PASS).
- [ ] **Step 5: Commit** `feat: scoring and results`

---

### Task 5: Storage (user songs and best scores)

**Files:**
- Create: `src/songs/storage.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Produces (all take a `Storage`-like `{ getItem; setItem; removeItem }` so tests can inject fakes; callers pass `window.localStorage` inside a try/catch getter `safeLocalStorage(): Storage | null`):
  - `loadUserSongs(st: Storage | null): Song[]` — key `recorder-tiles:songs`; skips invalid entries; `[]` on null/throw/corrupt JSON
  - `saveUserSong(st, song: Song): boolean` — refuses `builtIn`; replaces by id
  - `deleteUserSong(st, id: string): boolean`
  - `getBest(st, songId: string, mode: Mode): number | null` — key `recorder-tiles:best`
  - `recordScore(st, songId, mode, score: number): boolean` — returns true if new best

- [ ] **Step 1: Write failing tests** — round-trip save/load; `null` storage → `[]`; `getItem` throws → `[]`; `'{not json'` → `[]`; one valid + one invalid song stored → only the valid one returned; built-in refused; best per mode is independent; lower score doesn't replace best.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat: local storage for songs and best scores`

---

### Task 6: Keyboard input

**Files:**
- Create: `src/input/keyboard.ts`
- Test: `tests/keyboard.test.ts`

**Interfaces:**
- Produces:
  - `const KEY_ROWS = 'asdfghjkl;' + 'qwertyuiop' + '1234567890'` (lanes left→right take keys in this order; 27 lanes max fits)
  - `keysForLanes(count: number): string[]`
  - `interface NoteEvents { noteOn(note: NoteName, t: number): void; noteOff(t: number): void }`
  - `createKeyHandler(lanes: NoteName[], sink: NoteEvents): { keydown(e: { key: string; repeat: boolean; timeStamp: number }): void; keyup(e: { key: string; timeStamp: number }): void }` — case-insensitive; ignores `repeat` and unmapped keys; `keyup` only emits `noteOff` for the key currently sounding.
  - Event times use `e.timeStamp` (same clock as `performance.now()`).

- [ ] **Step 1: Write failing tests** — `keysForLanes(3)` → `['a','s','d']`; keydown `a` → `noteOn(lanes[0])`; keydown `a` with `repeat: true` → nothing; keydown `z` → nothing; press `a` then `s` then keyup `a` → no `noteOff` (s is sounding); keyup `s` → `noteOff`; `A` (shift) maps like `a`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat: keyboard input`

---

### Task 7: Note tracker with synthetic recorder audio

**Files:**
- Create: `src/audio/trackerSettings.ts`, `src/audio/noteTracker.ts`, `src/audio/synthetic.ts`
- Test: `tests/noteTracker.test.ts`, `tests/detection.test.ts`

**Interfaces:**
- Consumes: `frequencyToNote`, `NoteEvents`.
- Produces:
  - `TRACKER = { minClarity: 0.9, minRms: 0.01, steadyMs: 40, releaseMs: 60, dipRatio: 0.4 }`
  - `interface Frame { t: number; pitchHz: number; clarity: number; rms: number }`
  - `class NoteTracker { constructor(sink: NoteEvents, s = TRACKER); push(f: Frame): void; readonly current: NoteName | null }`
    - Valid frame = `clarity >= minClarity && rms >= minRms && frequencyToNote(pitchHz) !== null`.
    - Onset: a note is `on` once the same note is valid for `steadyMs`; `noteOn` time = **first** frame of that run (latency compensation).
    - Pitch change to another valid note held for `steadyMs` → `noteOn(new)` (judge treats as implicit off). Shorter changes are ignored (wobble).
    - Release: invalid for `releaseMs` → `noteOff` at the first invalid frame's time.
    - Re-attack: while on, `rms < dipRatio * runningPeak` followed by recovery above it → `noteOff` at dip start, `noteOn(same)` at recovery. `runningPeak` resets on each onset.
  - `renderSynthetic(events: { note: NoteName; startMs: number; endMs: number }[], opts: { sampleRate: number; totalMs: number; detuneCents?: number; noise?: number; tongueGapMs?: number; seed?: number }): Float32Array` — sine fundamental + 0.3 2nd harmonic at `soundingFrequency`, 15 ms attack/release ramps, seeded white noise, `tongueGapMs` of near-silence between back-to-back same notes.
  - `analyse(buf: Float32Array, sampleRate: number, hop = 512, size = 2048): Frame[]` — runs `pitchy` over sliding windows; `t` = window centre in ms.

- [ ] **Step 1: Write failing unit tests (`noteTracker.test.ts`, hand-built frames)** — steady A4 frames from t=0 → one `noteOn('A4', 0)` after 40 ms; 20 ms blip of B4 inside A4 → no event; 80 ms silence → `noteOff` at silence start; rms dip to 0.3× and back → `noteOff` + `noteOn('A4')`; low-clarity frames never start a note.
- [ ] **Step 2: Write failing pipeline tests (`detection.test.ts`)** — render each built-in song at its bpm (sampleRate 44100, noise 0.02, detune 20 cents, tongueGapMs 30), `analyse` → `NoteTracker` → `Judge` (recorder settings), ticking at each frame time. Expected: `status === 'won'` for both songs. Also: render Hot Cross Buns with `tongueGapMs: 0` → `lost` with `too-late` (held-through repeat); render with one note replaced → `wrong-note`.
- [ ] **Step 3: Run** — Expected: FAIL.
- [ ] **Step 4: Implement**, adjusting `TRACKER` values only if a pipeline test shows a real reason (record the reason in a comment).
- [ ] **Step 5: Run** — Expected: PASS.
- [ ] **Step 6: Commit** `feat: note tracker verified on synthetic recorder audio`

---

### Task 8: Microphone and preview player

**Files:**
- Create: `src/audio/mic.ts`, `src/audio/player.ts`
- Test: `tests/mic.test.ts`

**Interfaces:**
- Consumes: `NoteTracker`, `soundingFrequency`, `toTimedNotes`.
- Produces:
  - `type MicResult = { ok: true; stop(): void } | { ok: false; message: string }`
  - `startMic(onFrame: (f: Frame) => void, deps = { getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c), AudioContextCtor: AudioContext }): Promise<MicResult>` — `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`, `AnalyserNode` `fftSize 2048`, `requestAnimationFrame` loop reading `getFloatTimeDomainData`, rms + `pitchy`, `t = performance.now()`. Messages: `NotAllowedError` → "Microphone access was blocked. Allow it in the browser and try again."; `NotFoundError` / missing `mediaDevices` → "No microphone found."
  - `playSong(song: Song, ctx: AudioContext): { stop(): void }` — per note: triangle oscillator at `soundingFrequency`, gain envelope 20 ms attack / 40 ms release.

- [ ] **Step 1: Write failing tests** — injected `getUserMedia` rejecting `DOMException('x','NotAllowedError')` → `{ ok: false, message: 'Microphone access was blocked…' }`; `NotFoundError` → "No microphone found."; `deps.getUserMedia` undefined → "No microphone found."
- [ ] **Step 2–4:** FAIL → implement → PASS. (`playSong` has no unit test; verified by ear in Task 11.)
- [ ] **Step 5: Commit** `feat: microphone input and preview player`

---

### Task 9: Game session, game screen and results

**Files:**
- Create: `src/game/session.ts`, `src/ui/gameScreen.ts`, `src/ui/resultsScreen.ts`
- Test: `tests/session.test.ts`

**Interfaces:**
- Consumes: `Judge`, `computeResults`, `recordScore`, `NoteEvents`, `laneNotes`, `laneLabels`, `keysForLanes`.
- Produces:
  - `const LEAD_IN_MS = 3000` (first tile reaches the line 3 s after start), `const FALL_MS = 2000` (time a tile is visible before the line)
  - `class GameSession implements NoteEvents { constructor(song: Song, mode: Mode, startAt: number); noteOn; noteOff; tick(now: number): void; abandon(): void; readonly status: JudgeStatus | 'abandoned'; readonly judge: Judge; results(): Results }` — shifts song times by `startAt + LEAD_IN_MS`.
  - `mountGame(root: HTMLElement, song: Song, mode: Mode, onEnd: (r: Results | null, loss?: Judge['loss']) => void): () => void` — canvas: lanes with labels (+ key letter in keyboard mode), falling tiles (height ∝ duration, speed = canvas height / `FALL_MS`), hit line, lit lane for the sounding note; `requestAnimationFrame` → `session.tick(performance.now())`; `visibilitychange` hidden → `abandon()` → `onEnd(null)`. Recorder mode wires `startMic` → `NoteTracker` → session, showing the mic error and calling `onEnd(null)` on failure.
  - `mountResults(root, song, mode, results, loss | undefined, isNewBest: boolean, actions: { retry(): void; menu(): void })` — shows score, rating counts, accuracy %, and on a loss the reason in words ("Wrong note", "Too early", "Too late", "Let go too early") and progress %.

- [ ] **Step 1: Write failing tests (`session.test.ts`)** — times offset by `startAt + LEAD_IN_MS`; `abandon()` → status `'abandoned'` and later `tick` far past the end does not produce `'lost'`; `results()` after a win matches `computeResults`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat: game session, canvas game screen, results`

---

### Task 10: Menu, mic check and router

**Files:**
- Create: `src/ui/menuScreen.ts`, `src/ui/micCheckScreen.ts`; Modify: `src/main.ts`, `src/style.css`, `index.html` (title "Recorder Tiles")

**Interfaces:**
- Consumes: `BUILTIN_SONGS`, `loadUserSongs`, `getBest`, `startMic`, `NoteTracker`, `mountGame`, `mountResults`.
- Produces:
  - `mountMenu(root, songs: Song[], best: (id: string, m: Mode) => number | null, actions: { play(song: Song, mode: Mode): void; micCheck(): void; edit(song?: Song): void })` — song list (built-ins first, then user songs) with best scores for both modes, mode toggle, buttons Play / Mic check / New song / Edit (user songs only).
  - `mountMicCheck(root, back: () => void)` — big live label of the detected note (or "—"), clarity/volume bar.
  - `main.ts`: a tiny screen switcher; each `mount*` returns or is followed by a cleanup function.

- [ ] **Step 1: Implement.** No unit tests (DOM glue); covered by Task 12 smoke.
- [ ] **Step 2: Verify** `npx tsc --noEmit` clean, `npm run build` succeeds, `npm test` still passes.
- [ ] **Step 3: Commit** `feat: menu, mic check, routing`

---

### Task 11: Song editor

**Files:**
- Create: `src/editor/editorModel.ts`, `src/ui/editorScreen.ts`; Modify: `src/main.ts`
- Test: `tests/editorModel.test.ts`

**Interfaces:**
- Consumes: `Song`, `SongNote`, `RECORDER_NOTES`, `validateSong`, `saveUserSong`, `playSong`.
- Produces:
  - `const STEP_BEATS = 0.5` (grid row = eighth note)
  - `toggleCell(notes: SongNote[], note: NoteName, row: number): SongNote[]` — empty cell adds `{note, startBeat: row*STEP, beats: STEP}` and removes any note overlapping that row (monophonic); a cell inside an existing note removes that note.
  - `extendTo(notes: SongNote[], index: number, row: number): SongNote[]` — sets length to reach `row` (min one step); refuses (returns input) if it would overlap another note.
  - `newSong(): Song` — id `user-${Date.now()}`, name "My song", bpm 90, `notes: []`.
  - `mountEditor(root, song: Song, actions: { tryIt(song: Song): void; back(): void })` — grid (columns = 27 notes with labels, rows scroll down in time), click = `toggleCell`, drag down = `extendTo`, name + bpm inputs, Preview (`playSong`), Save (disabled while `!validateSong`), Try it (same), Delete for saved songs.

- [ ] **Step 1: Write failing tests** — add a cell; click same cell removes; adding at a row covered by another note replaces it (no overlap); `extendTo` grows a note; `extendTo` into the next note is refused; result of any sequence of ops passes `validateSong` when non-empty.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Manual check** `npm run dev`: make a 4-note song, Preview sounds right, Save, it appears in the menu, Try it starts the game.
- [ ] **Step 6: Commit** `feat: song editor`

---

### Task 12: Smoke test and README

**Files:**
- Create: `e2e/smoke.mjs`; Modify: `package.json` (`"e2e": "node e2e/smoke.mjs"`), `README.md`

**Interfaces:**
- Consumes: built app via `vite preview`.

- [ ] **Step 1: Write `e2e/smoke.mjs`** using `require('playwright')`/`import { chromium } from 'playwright'` (pre-installed; do not install another version). Starts `npx vite preview --port 4173`, then: menu lists "Hot Cross Buns"; choose keyboard mode, Play; press a lane key for the wrong lane after the lead-in → results screen shows "Wrong note"; then simulate `localStorage` throwing (`page.addInitScript` overriding `Storage.prototype.getItem` to throw) and reload → built-in songs still listed.
- [ ] **Step 2: Run** `npm run build && npm run e2e` — Expected: exits 0, prints each check passed.
- [ ] **Step 3: README** — what the game is, `npm install`, `npm run dev`, how to play both modes, the mic check tip, that recorder detection may need tuning (`src/audio/trackerSettings.ts`, `src/game/settings.ts`).
- [ ] **Step 4: Final verification** `npm test && npx tsc --noEmit && npm run build && npm run e2e` all pass.
- [ ] **Step 5: Commit** `test: browser smoke test; docs: README`
