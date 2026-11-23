# PROJECT VICE: HURRICANE CITY

[![Play on make.fun](https://make.fun/badge/play.svg)](https://make.fun/bounty/gta6-01)
[![Compete on make.fun](https://make.fun/badge/compete.svg)](https://make.fun/bounty/gta6-01)
[![Built with make.fun](https://make.fun/badge/built.svg)](https://make.fun)

An original open-world crime game for the **Make GTA 6** bounty
([gta6-01](https://make.fun/bounty/gta6-01)): a neon-soaked coastal metropolis —
Marisol & Ocean Drive — built entirely from procedural code. No Rockstar assets, no
external files: every building, palm, car, neon sign, sound and song is generated
in the browser by the game's own code.

**Play it:** serve `game/` with any static server (`node serve.ts`, then open
http://localhost:8080) and drive. No install, no network, no account.

## The city

Oceanfront Art Deco strip with giant glowing hotel signs (**PALM BREEZE HOTEL**,
**OCEAN DRIVE**), a downtown skyline, a suspension bridge between two islands, a
marina full of yachts and an elevated coastal highway. The weather auto-cycles
between **Golden Sunset** — pink-orange sky, swaying palms, sun glittering on the
ocean — and **Neon Hurricane Mode** — purple storm clouds, lightning that lights
the whole skyline, slanted rain, wind-bent palms and flooded asphalt mirroring
pink/cyan neon, headlights and police lightbars. Press **T** to toggle the storm.

## Play

- **Drive or walk, seamlessly.** Start inside a sports car on Ocean Drive. **F**
  to exit or enter any car, **Shift** for nitro (blue flames), **Space** to drift,
  **WASD** to drive, **Shift** to sprint on foot, **Space** to jump.
- **Fight.** Left click to shoot (muzzle flash, tracers), **1–3** for Pistol / SMG /
  Shotgun, full weapon wheel always on screen.
- **Wanted, 1–5 stars.** Speed past cops, crash, steal or shoot and Marisol PD
  answers: cruisers chase and ram, roadblocks go up, and at 4+ stars **AIR ONE**,
  the police helicopter, pins you with a searchlight cone. The dispatch panel
  names every unit hunting you, live.
- **Missions, repeatable.** Street Race checkpoints, a Contraband Delivery against
  the hurricane timer, and a Getaway Escape — all marked by glowing 3D beacons.
  **N** starts the next job; fixer **MIRA** talks you through it.
- **Neon Safehouse Garage.** Press **G** (or drive into the cyan bay) to repair,
  repaint, change underbody neon and swap your collected sports cars.
- **Progression saves** to localStorage: cash, respect rank, cars, best times.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Drive / walk |
| Shift | Nitro (in car) / sprint (on foot) |
| Space | Handbrake drift (in car) / jump (on foot) |
| F | Enter / exit car, hijack |
| Click | Shoot |
| 1–3 | Pistol / SMG / Shotgun |
| T | Toggle hurricane weather |
| G | Safehouse garage |
| N | Next mission |
| R | Radio (VIBE 104.5 FM synthwave) |
| M | Mute |
| H | Help / pause |

## Tech

- Three.js r170, vendored under `game/vendor/` — the only library, fully offline.
- Procedural canvas textures (windows, neon signs, road markings, wet asphalt),
  procedural Web Audio (engine, sirens, rain, thunder, gunfire, synthwave radio).
- Split source, one job per file: `game/src/city.js` (world + weather),
  `vehicles.js` (cars, traffic, helicopter), `police.js` (wanted + dispatch),
  `missions.js` (jobs + garage + save), `player.js` (driving, on-foot, combat,
  particles), `hud.js` (HUD, minimap, weapon wheel, dialogue), `audio.js`,
  `textures.js`, `rng.js`, `shots.js` (screenshot scenes), `main.js` (boot + loop).

## Referral

Play more make.fun bounties with referral code `ebv85brk`.

## License

MIT — see [LICENSE](LICENSE).
