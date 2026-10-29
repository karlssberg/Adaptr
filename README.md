# Recorder Tiles

A rhythm game in the style of Magic Tiles. Notes fall down lanes and you play
them on time, either on your computer keyboard or on a real recorder picked up
by your microphone. The first mistake ends the song. There is also a song
editor for making your own tunes.

## Requirements

- Node 22 or newer
- A desktop browser
- For recorder mode: the page must be served from `localhost` or HTTPS, or the
  browser will not allow microphone access

## Commands

```
npm install
npm run dev                  # start the dev server
npm test                     # unit tests
npm run build && npm run e2e # production build, then browser smoke test
```

The smoke test needs Playwright, which is not a project dependency: install it
globally with `npm i -g playwright`, then download its browser with
`npx playwright install chromium`. The test looks for Playwright in the project,
then in the global npm root (`npm root -g`), then in `/opt/node22`, where this
project's dev container has it.

## How to play

Pick a song and a mode on the menu, then press Play.

**Keyboard mode.** Each lane shows the key to press. Press it as the note
reaches the hit line, and hold it for long notes.

**Recorder mode.** Play the notes on your recorder. Run **Mic check** from the
menu first to confirm the game hears you and to see which note it detects.
Tongue repeated notes (a short "tu") so the game can tell them apart.

The first mistake loses: a wrong note, playing too early or too late, or
letting go of a long note early. Press **Esc** to leave a game at any time.

Hits are rated by timing:

- **Perfect**: right on the beat
- **Great**: slightly off
- **Good**: a bit further off, still counts

Better ratings score more.

## Song editor

Choose **New song** on the menu (or **Edit** on one of your own songs). Each
column is a recorder note and each row is a step in time.

- Click an empty cell to add a note.
- Drag down from a note's first cell to make it longer.
- Click a note to remove it.
- Set the song name and BPM in the fields at the top.
- **Preview** plays the song (press again to stop), **Try it** plays it as a
  game, **Save** stores it, and **Delete** removes it (shown only for saved
  songs).
- After **Try it**, **Back to editor** returns to the song with your unsaved
  changes intact. Scores from **Try it** are not recorded as bests.
- **Back** asks before discarding unsaved changes.

Songs are stored in this browser only. Built-in songs cannot be edited.

## Tuning

Timing windows and scoring live in `src/game/settings.ts`. Pitch detection
for recorder mode lives in `src/audio/trackerSettings.ts`. Recorder detection
was tuned on synthetic audio only, never on a real recorder, so you may need to
adjust these values for your instrument and microphone.
