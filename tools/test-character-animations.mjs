import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = process.cwd();
const dir = 'assets/characters/animations';
const manifest = JSON.parse(await readFile(join(root, dir, 'manifest.json'), 'utf8'));
let images = 0, gifs = 0;

async function png(path, w, h, baseline = null) {
  const f = join(root, path);
  await access(f);
  const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, w, `width ${path}`);
  assert.equal(info.height, h, `height ${path}`);
  assert.equal(info.channels, 4, `rgba ${path}`);
  assert.equal(data[3], 0, `transparent corner ${path}`);
  let pixels = 0, lastOpaqueY = -1, left = w, right = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const alpha = data[(y * w + x) * 4 + 3];
    if (alpha < 65) continue;
    pixels++; lastOpaqueY = y; left = Math.min(left, x); right = Math.max(right, x);
  }
  assert(pixels > 1_500, `foreground missing: ${path}`);
  assert(left > 2 && right < w - 3, `frame edge clipped or neighbouring pose contamination: ${path} [${left},${right}]`);
  if (baseline !== null) assert(Math.abs(lastOpaqueY - baseline) <= 4, `foot baseline ${path}: y=${lastOpaqueY}`);
  images++;
}

async function gif(path, width, height, pages) {
  const m = await sharp(join(root, path), { animated: true }).metadata();
  assert.equal(m.width, width, `GIF width ${path}`);
  assert.equal(m.pageHeight, height, `GIF height ${path}`);
  assert.equal(m.pages, pages, `GIF page count ${path}`);
  assert(m.hasAlpha, `transparent GIF ${path}`);
  gifs++;
}

for (const [who, entry] of Object.entries(manifest.characters)) {
  for (const side of ['front', 'back']) {
    const set = entry[side];
    assert.equal(set.poses.length, 4, `${who} ${side} poses`);
    assert.deepEqual(set.pivot, { x: 224, y: 751 });
    for (const pose of set.poses) await png(pose.file, 448, 768, 751);
    for (let i = 0; i < 4; i++) await png(`${dir}/${who}/${side}/jump/frame_${String(i).padStart(2, '0')}.png`, 448, 768);
    await png(set.animations.squat.atlas, 448 * 4, 768);
    await png(set.animations.squatJump.atlas, 448 * 4, 768);
    await gif(set.animations.squat.gif, 448, 768, 6);
    await gif(set.animations.squatJump.gif, 448, 768, 8);
  }
  assert.equal(entry.goal.poses.length, 3, `${who} goal low/high/reaction`);
  assert.deepEqual(entry.goal.pivot, { x: 416, y: 900 });
  for (const pose of entry.goal.poses) await png(pose.file, 832, 928, 900);
  await png(entry.goal.animations.goalRock.atlas, 832 * 2, 928);
  await gif(entry.goal.animations.goalRock.gif, 832, 928, 4);
}

console.log('PASS: 2 characters × (8 squat poses + 8 jump variants + 2 rear goal poses + 1 reaction cut)');
console.log(`PASS: ${images} transparency/alignment checks, ${gifs} animated GIF checks`);
console.log('NOTE: Game target hitboxes and 40-stage placements are NOT integrated or tested here.');
