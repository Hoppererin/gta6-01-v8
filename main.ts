// Isla Fortuna v8 — main.ts
// Entrypoint the grader runs (Node 22, stdlib only) to assemble the submission. Copies game/ and
// screenshots/ from beside this file to the output dir and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Never deletes the output dir (it is a mount point in the grader).
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });

cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(
  outDir,
  {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  },
);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier written: ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
