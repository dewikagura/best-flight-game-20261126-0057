// Cendrawasih Airlift — the entrypoint: copy the game and its screenshots
// into $MAKEFUN_OUTPUT_DIR and write /output/dossier.json with the kit's
// buildDossier. Copy-only, Node 22 standard library only: no network, no
// build step, no dependencies. Run it twice and the outputs are identical.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const SLUG = 'best-flight-game-20261126-0057';
const GAME_NAME = 'Cendrawasih Airlift';

// The bounty gate's caps, exactly as the scorer passes them.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// The screenshots the judge sees: 3 or 4 renders, each at most 256 KiB,
// long side at most 1280 px, short side at least 480 px.
const SHOT_MIN_COUNT = 3;
const SHOT_MAX_BYTES = 262144;
const SHOT_LONG_MAX = 1280;
const SHOT_SHORT_MIN = 480;

function fail(message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

// A PNG's size lives in its IHDR chunk; a JPEG's in its first SOF marker.
function imageDimensions(bytes: Buffer): { width: number; height: number } | null {
  const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (pngMagic.every((b, i) => bytes[i] === b) && bytes.length >= 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = bytes[i + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return { width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = bytes.readUInt16BE(i + 2);
      i += 2 + len;
    }
  }
  return null;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR;
  if (!outDir) fail('MAKEFUN_OUTPUT_DIR is not set: run with the output directory in the environment');
  const out = resolve(outDir);
  const root = dirname(fileURLToPath(import.meta.url));
  if (out === root || out.startsWith(root + '/')) {
    fail(`refusing to write the output inside the entry directory (${out})`);
  }

  const gameDir = join(root, 'game');
  const shotsDir = join(root, 'screenshots');
  if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing from the entry');

  // Fresh output: game/ and screenshots/ are replaced wholesale, so a
  // stale file from an earlier run can never leak into the submission.
  mkdirSync(out, { recursive: true });
  for (const name of ['game', 'screenshots']) {
    const target = join(out, name);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }
  cpSync(gameDir, join(out, 'game'), { recursive: true });
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

  // The screenshots the judge sees, checked before the dossier is built.
  const shots = readdirSync(join(out, 'screenshots'))
    .filter((name) => !name.startsWith('.'))
    .sort();
  if (shots.length < SHOT_MIN_COUNT) fail(`screenshots/: ${shots.length} image(s), need at least ${SHOT_MIN_COUNT}`);
  if (shots.length > CAPS.screenshots.max) fail(`screenshots/: ${shots.length} images, at most ${CAPS.screenshots.max}`);
  for (const name of shots) {
    const file = join(out, 'screenshots', name);
    const bytes = readFileSync(file);
    if (bytes.length > SHOT_MAX_BYTES) {
      fail(`screenshots/${name}: ${bytes.length} bytes, over the ${SHOT_MAX_BYTES} allowed`);
    }
    const dims = imageDimensions(bytes);
    if (!dims) fail(`screenshots/${name}: not a PNG or JPEG I can read`);
    const long = Math.max(dims.width, dims.height);
    const short = Math.min(dims.width, dims.height);
    if (long > SHOT_LONG_MAX) fail(`screenshots/${name}: ${dims.width}x${dims.height}, long side over ${SHOT_LONG_MAX}`);
    if (short < SHOT_SHORT_MIN) fail(`screenshots/${name}: ${dims.width}x${dims.height}, short side under ${SHOT_SHORT_MIN}`);
    console.log(`shot ${name}: ${dims.width}x${dims.height}, ${bytes.length} bytes`);
  }

  const dossier = buildDossier(out, CAPS);
  writeFileSync(join(out, 'dossier.json'), dossier);
  const gameFiles = readdirSync(join(out, 'game'), { recursive: true });
  console.log(`${GAME_NAME} (${SLUG}): copied ${gameFiles.length} game entries and ${shots.length} screenshots to ${out}`);
  console.log(`dossier.json: ${dossier.length} bytes`);
}

main();
