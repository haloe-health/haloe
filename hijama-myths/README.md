# haloe — Hijama Myths (Remotion)

Vertical 1080×1920 · 30fps · 15s motion-graphic template for the 8-part "Hijama Myths" series.

## Setup
```bash
cd hijama-myths
npm install
```

## Preview / render
```bash
npm run studio     # Remotion Studio, pick composition myth-01
npm run render     # -> out/haloe-myth-01.mp4
npm run thumb      # -> out/haloe-myth-01-thumb.png (final frame)
```
Other episodes: `npx remotion render src/index.ts myth-02 out/haloe-myth-02.mp4`.

## Add a new episode
Everything episode-specific lives in `src/episodes.ts`. Add one object to the `episodes` array
(copy episode 1): `episodeNumber`, `hook`, `beat`, `signText`, `panelTitle`, `points`
(`icon` + `"Title → result"`), `quote`, `captions` (seconds), `tagline`, `cta`, `seriesLabel`.
A composition `myth-NN` is registered automatically. Icons available: cup, line, drop, leaf, clock, heart, shield, sparkle
(add more in `src/components/Icons.tsx`). The panel supports 1-2 points plus the client quote.

Scene timing is shared (`src/timing.ts`): forest 0–3.5s, discovery 3.5–5.5s, knock/door 5.5–7s,
haloe Home 7–12.5s, end card 12.5–15s. Keep captions out of the top 200px / bottom 250px.

## Shared components (`src/components`)
`Forest`, `CupHouse` (cup + door + sign), `Halima` (vector character), `Interior` (haloe Home),
`InfoPanel`, `Captions`, `EndCard`.

## Audio (optional)
Drop files in `assets/` — they are detected automatically on `studio`/`render`:
`voiceover.mp3`, `music.mp3` (played at 12% volume), `knock.mp3` (plays at both knocks, 5.7s and 6.1s).
None present = silent render.

## Reference art
`assets/halima-reference.jpg` is the photo Halima was drawn from. Add `assets/clinic-interior.png`
and re-skin `src/components/Interior.tsx` (colours, furniture) to match the real room exactly.
