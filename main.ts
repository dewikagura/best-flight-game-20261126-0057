// main.ts — hands the game in.
//
// Copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json with buildDossier from
// vendor/makefun-game.ts. Standard library only, no network, no clock:
// the same repository always writes the same bytes, so the grader's two
// runs agree byte for byte.
import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// Copy one directory tree, entries in code-unit order, files only.
function copyTree(srcDir: string, destDir: string): number {
  mkdirSync(destDir, { recursive: true });
  let files = 0;
  const entries = readdirSync(srcDir).sort();
  for (const name of entries) {
    const src = join(srcDir, name);
    const dest = join(destDir, name);
    const st = statSync(src);
    if (st.isDirectory()) {
      files += copyTree(src, dest);
    } else if (st.isFile()) {
      cpSync(src, dest);
      files += 1;
    }
  }
  return files;
}

function countFiles(dir: string): number {
  let n = 0;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    n += st.isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

function main(): void {
  // Fail with a sentence, not a stack trace, when an input is missing.
  const gameDir = join(repoRoot, "game");
  const shotsDir = join(repoRoot, "screenshots");
  if (!statSync(gameDir, { throwIfNoEntry: false })) {
    throw new Error("game/ is missing — nothing to hand in");
  }
  if (!statSync(shotsDir, { throwIfNoEntry: false })) {
    throw new Error("screenshots/ is missing — take the four shots first");
  }
  mkdirSync(outDir, { recursive: true });
  // Start clean so a stale file from an earlier run can never leak in.
  rmSync(join(outDir, "game"), { recursive: true, force: true });
  rmSync(join(outDir, "screenshots"), { recursive: true, force: true });
  rmSync(join(outDir, "dossier.json"), { force: true });

  const gameFiles = copyTree(join(repoRoot, "game"), join(outDir, "game"));
  const shotFiles = copyTree(join(repoRoot, "screenshots"), join(outDir, "screenshots"));

  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, "dossier.json"), Buffer.from(dossier));

  const total = countFiles(outDir);
  console.log(
    "cendrawasih-airlift: game=" + gameFiles +
    " screenshots=" + shotFiles +
    " dossierBytes=" + dossier.length +
    " totalFiles=" + total +
    " out=" + outDir,
  );
}

main();
