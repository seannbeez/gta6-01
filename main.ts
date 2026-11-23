// PROJECT VICE: HURRICANE CITY — gta6-01 entry program (Node 22, stdlib only).
// Hands the game in: copies game/ and screenshots/ from beside this file into
// /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes dossier.json
// with the vendored make.fun library, exactly as the kit's starter does for its
// own game. No network, no installs, no build step.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The sealed gate's caps (reference/gate.json): text_max_bytes shapes the dossier
// text; the rest refuse an entry the scorer would refuse (over 4 screenshots or
// one over 256 KiB; game/ over 993 files or 48 MiB; a game/ path over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
