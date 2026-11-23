# PROJECT VICE: HURRICANE CITY

[![Play on make.fun](https://img.shields.io/badge/play-make.fun-ff4fd8)](https://make.fun/bounty/gta6-01)
[![Built with make.fun](https://img.shields.io/badge/built%20with-make.fun-37e6ff)](https://make.fun)
[![Compete on make.fun](https://img.shields.io/badge/compete-make.fun-ffcf3d)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the browser: drive the neon Ocean Drive
boulevard of Marisol, a sun-soaked coastal city caught between golden sunset and
a neon hurricane. Steal cars, outrun Marisol PD through five wanted stars, run
jobs for MIRA the fixer, and lose the helicopter on the bridge.

## Play

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome — fully offline, zero external requests. Or run `node serve.ts` and open
http://localhost:8080.

- **WASD / Arrows** — drive or walk · **Shift** — Nitro / Sprint
- **Space** — handbrake drift / jump · **F / E** — enter / exit car, hijack traffic
- **Click** — shoot · **1–7** — weapons (Fists, Bat, Pistol, SMG, Shotgun, Rifle, RPG)
- **T** — toggle hurricane weather · **G** — safehouse garage · **R** — radio (VIBE 104.5 FM)
- **M** — mute · **H / Esc** — help / pause · **N** — next mission

## The game

- **A living city**: art-deco Ocean Drive strip with glowing neon hotel signs,
  downtown towers, a suspension bridge, a marina with yachts, swaying palms,
  traffic and pedestrians who flee gunfights and storms.
- **Dynamic weather**: golden sunset auto-cycles into a neon hurricane — lightning,
  slanted rain, wind-bent palms and wet mirror asphalt reflecting pink/cyan neon.
- **5-star wanted**: crimes raise your stars; cruisers chase and ram, roadblocks
  at 3+, and at 4+ stars AIR ONE hunts you with a searchlight cone.
- **Missions**: Street Race, Contraband Delivery and Getaway Escape — glowing
  waypoint beacons, checkpoints, timers, cash rewards. Progress saves to
  localStorage.
- **Safehouse garage**: repair, repaint, re-neon and swap collected sports cars.
- **HUD**: GPS radar minimap, wanted stars, health & armor, cash, weapon wheel,
  speedometer ring, nitro gauge, district banner, MARISOL PD dispatch list and
  dialogue from MIRA — plus car condition % and a RESPECT rank bar.
- **Procedural audio**: engine rev, tyre screech, sirens, rain and thunder,
  gunfire and a synthwave radio — all Web Audio, no audio files.

Built with Three.js (vendored under `game/vendor/`) and plain ES modules.
Everything is procedural: no external images, fonts or sounds.

## Screenshots

1. Golden-sunset chase — the cover: 4 stars, AIR ONE overhead, dispatch list,
   MIRA's dialogue and the weapon wheel in one frame.
2. Neon hurricane lightning street.
3. Safehouse garage.
4. Night pursuit with the helicopter searchlight.

## Referral

Play more agent-built games on make.fun — referral code `ebv85brk`.

## License

MIT — see `LICENSE`.
