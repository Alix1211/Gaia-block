/**
 * Source-preserving character animation packer.
 *
 * Split existing transparent PNG pose sheets, remove detached background flecks,
 * and place every pose on a shared transparent canvas with a stable foot baseline.
 * NO redrawing, independent pose scaling, or frame interpolation is performed.
 *
 * Usage: node tools/build-character-animations.mjs
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'assets/characters/source_sheets');
const OUTPUT = join(ROOT, 'assets/characters/animations');
const gifCommands = [];
const POSE = { width: 448, height: 768, bottom: 751, maxHeight: 731, maxWidth: 402 };
const GOAL = { width: 832, height: 928, bottom: 900, maxHeight: 858, maxWidth: 804 };
const files = {
  brown: {
    front: '06-1000109520.png',
    back: '08-1000109517.png',
    goalLow: '01-1000109532.png',
    goalHigh: '02-1000109528.png',
    reaction: '03-1000109527.png',
    sheetIndex: 0
  },
  choseon: {
    front: '07-1000109519.png',
    back: '09-1000109516.png',
    goalLow: '01-1000109532.png',
    goalHigh: '02-1000109528.png',
    reaction: '03-1000109527.png',
    sheetIndex: 1
  }
};

const manifest = {
  version: 1,
  generatedBy: 'tools/build-character-animations.mjs',
  transparent: true,
  notes: [
    'frame_00 is deepest squat and frame_03 is fully standing.',
    'Squat and squat-jump are different animation timelines; jump has extra vertical lift.',
    'Goal rocking has two original rear-view poses. Look-back is a separate reaction.',
    'All frames in a row share a fixed canvas and baseline; images are source-preserving.'
  ],
  characters: {}
};

async function sourceData(filename) {
  const { data, info } = await sharp(join(SOURCE, filename)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error(`Not RGBA: ${filename}`);
  return { data, width: info.width, height: info.height };
}

/** Extract a fixed-width panel, then drop disconnected debris in transparent space. */
function separate(image, index, divisions, filename) {
  if (image.width % divisions !== 0) throw new Error(`Bad panel count: ${filename}`);
  const width = image.width / divisions;
  const height = image.height;
  const pixels = width * height;
  const rgba = Buffer.allocUnsafe(pixels * 4);
  for (let y = 0; y < height; y++) {
    const from = (y * image.width + index * width) * 4;
    image.data.copy(rgba, y * width * 4, from, from + width * 4);
  }

  const visited = new Uint8Array(pixels);
  const keep = new Uint8Array(pixels);
  const components = [];
  const queue = new Int32Array(pixels);
  // Fully opaque character outlines form coherent islands. Isolated gray marks
  // in the supplied art should not become stray pixels in the cutouts.
  for (let seed = 0; seed < pixels; seed++) {
    if (visited[seed] || rgba[seed * 4 + 3] < 65) continue;
    let head = 0, tail = 1, saturation = 0;
    queue[0] = seed;
    visited[seed] = 1;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const y = (current / width) | 0;
      minX = Math.min(x, minX); maxX = Math.max(x, maxX);
      minY = Math.min(y, minY); maxY = Math.max(y, maxY);
      const p = current * 4;
      const lo = Math.min(rgba[p], rgba[p + 1], rgba[p + 2]);
      const hi = Math.max(rgba[p], rgba[p + 1], rgba[p + 2]);
      saturation += hi - lo;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (visited[ni] || rgba[ni * 4 + 3] < 65) continue;
        visited[ni] = 1;
        queue[tail++] = ni;
      }
    }
    components.push({ size: tail, saturated: saturation / tail, minX, minY, maxX, maxY, startsAt: seed });
  }
  if (!components.length) throw new Error(`No foreground in ${filename} panel ${index}`);
  const main = components.reduce((best, comp) => comp.size > best.size ? comp : best);
  // In all seven supplied multi-pose sheets each complete character (including
  // crown, hair, feet and loose tassels) forms the single largest component.
  // Neighbouring poses DO leak a shoe/toe across cell boundaries in two sheets.
  // Only the largest component belongs to this pose; area thresholds preserve
  // that foreign toe, so deliberately discard EVERY secondary component.
  visited.fill(0);
  let removed = 0;
  for (let seed = 0; seed < pixels; seed++) {
    if (visited[seed] || rgba[seed * 4 + 3] < 65) continue;
    let head = 0, tail = 1;
    queue[0] = seed; visited[seed] = 1;
    while (head < tail) {
      const current = queue[head++];
      const x = current % width, y = (current / width) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (visited[ni] || rgba[ni * 4 + 3] < 65) continue;
        visited[ni] = 1;
        queue[tail++] = ni;
      }
    }
    if (tail === main.size) {
      for (let i = 0; i < tail; i++) keep[queue[i]] = 1;
    } else {
      removed++;
    }
  }

  // Recover source antialiased outline pixels up to two pixels around the
  // retained opaque body, without restoring distant source specks.
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const pos = y * width + x;
    if (rgba[pos * 4 + 3] === 0) continue;
    let near = !!keep[pos];
    if (!near) {
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && keep[ny * width + nx]) { near = true; break; }
      }
    }
    if (near) {
      minX = Math.min(x, minX); maxX = Math.max(x, maxX);
      minY = Math.min(y, minY); maxY = Math.max(y, maxY);
    } else {
      rgba[pos * 4 + 3] = 0;
    }
  }
  if (maxX < 0) throw new Error(`Empty character after cleanup: ${filename}, ${index}`);
  return { rgba, width, height, bbox: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }, removed };
}

function cutBuffer(part) {
  const { left, top, width, height } = part.bbox;
  const cut = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    part.rgba.copy(cut, y * width * 4, ((top + y) * part.width + left) * 4, ((top + y) * part.width + left + width) * 4);
  }
  return cut;
}

async function normalizeFrames(parts, canvas, destination) {
  await mkdir(destination, { recursive: true });
  const maxH = Math.max(...parts.map(p => p.bbox.height));
  const maxW = Math.max(...parts.map(p => p.bbox.width));
  const scale = Math.min(canvas.maxHeight / maxH, canvas.maxWidth / maxW);
  const files = [];
  const stats = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const dw = Math.max(1, Math.round(part.bbox.width * scale));
    const dh = Math.max(1, Math.round(part.bbox.height * scale));
    const left = Math.floor((canvas.width - dw) / 2);
    const top = canvas.bottom - dh;
    if (left < 0 || top < 0) throw new Error(`Clipped frame ${destination} ${i}`);
    const resized = await sharp(cutBuffer(part), { raw: { width: part.bbox.width, height: part.bbox.height, channels: 4 } })
      .resize(dw, dh, { kernel: 'lanczos3', premultiplied: true }).png().toBuffer();
    const filename = `frame_${String(i).padStart(2, '0')}.png`;
    const fullpath = join(destination, filename);
    await sharp({ create: { width: canvas.width, height: canvas.height, channels: 4, background: '#00000000' } })
      .composite([{ input: resized, left, top }])
      .png({ compressionLevel: 9 }).toFile(fullpath);
    files.push(fullpath);
    stats.push({ file: relative(ROOT, fullpath), x: left, y: top, width: dw, height: dh, removedIslands: part.removed });
  }
  return { files, stats, scale: Number(scale.toFixed(5)), pivot: { x: canvas.width / 2, y: canvas.bottom } };
}

async function atlas(frames, canvas, output) {
  const composites = frames.map((input, idx) => ({ input, left: canvas.width * idx, top: 0 }));
  await sharp({ create: { width: canvas.width * frames.length, height: canvas.height, channels: 4, background: '#00000000' } })
    .composite(composites).png({ compressionLevel: 9 }).toFile(output);
}

function gif(sequence, output) {
  // sequence: [{file,delay}] ; delay in 1/100 second. Full-sized frames,
  // disposal=background prevents the previous pose from showing through.
  const args = ['-background', 'none', '-dispose', 'background'];
  const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
  for (const f of sequence) args.push('-delay', String(f.delay), relative(ROOT, f.file));
  args.push('-loop', '0', '-layers', 'Optimize', relative(ROOT, output));
  gifCommands.push('convert ' + args.map(quote).join(' '));
}

async function jumpFrames(base, destination, canvas) {
  await mkdir(destination, { recursive: true });
  const lift = [0, 4, 17, 37];
  const files = [];
  for (let i = 0; i < base.length; i++) {
    const shift = lift[i];
    const file = join(destination, `frame_${String(i).padStart(2, '0')}.png`);
    const content = await sharp(base[i]).extract({ left: 0, top: shift, width: canvas.width, height: canvas.height - shift }).png().toBuffer();
    await sharp({ create: { width: canvas.width, height: canvas.height, channels: 4, background: '#00000000' } })
      .composite([{ input: content, left: 0, top: 0 }]).png({ compressionLevel: 9 }).toFile(file);
    files.push(file);
  }
  return { files, lift };
}

async function buildSquats(character, view, filename) {
  const source = await sourceData(filename);
  const segments = Array.from({ length: 4 }, (_, i) => separate(source, i, 4, filename));
  const folder = join(OUTPUT, character, view);
  const basic = await normalizeFrames(segments, POSE, folder);
  const row = join(folder, 'squat-atlas.png');
  await atlas(basic.files, POSE, row);
  const order = [3, 2, 1, 0, 1, 2];
  const squatGif = join(folder, 'squat.gif');
  gif(order.map((idx, j) => ({ file: basic.files[idx], delay: j === 3 ? 19 : 12 })), squatGif);
  const hopped = await jumpFrames(basic.files, join(folder, 'jump'), POSE);
  const jumpGif = join(folder, 'squat-jump.gif');
  const jumpOrder = [0, 1, 2, 3, 3, 2, 1, 0];
  gif(jumpOrder.map((idx, j) => ({ file: hopped.files[idx], delay: (j === 0 || j === 4) ? 10 : 6 })), jumpGif);
  const jumpAtlas = join(folder, 'jump', 'squat-jump-atlas.png');
  await atlas(hopped.files, POSE, jumpAtlas);
  return {
    source: `assets/characters/source_sheets/${filename}`,
    canvas: { width: POSE.width, height: POSE.height },
    pivot: basic.pivot,
    scale: basic.scale,
    poses: basic.stats,
    animations: {
      squat: { frames: order, delayCs: [12, 12, 12, 19, 12, 12], gif: relative(ROOT, squatGif), atlas: relative(ROOT, row) },
      squatJump: { frames: jumpOrder, delayCs: [10, 6, 6, 6, 10, 6, 6, 6], liftPx: hopped.lift, gif: relative(ROOT, jumpGif), atlas: relative(ROOT, jumpAtlas) }
    }
  };
}

async function buildGoal(character, spec) {
  const input = await Promise.all([spec.goalLow, spec.goalHigh, spec.reaction].map(sourceData));
  const cuts = input.map((image, i) => separate(image, spec.sheetIndex, 2, [spec.goalLow, spec.goalHigh, spec.reaction][i]));
  const folder = join(OUTPUT, character, 'goal');
  const rendered = await normalizeFrames(cuts, GOAL, folder);
  const names = ['low.png', 'high.png', 'look-back.png'];
  // Stable descriptive names: frame_00 = low, 01 = high, 02 = look-back.
  for (let i = 0; i < names.length; i++) {
    // sharp re-encoding is used to write an alias, leaving the aligned master.
    await sharp(rendered.files[i]).png().toFile(join(folder, names[i]));
  }
  const goalAtlas = join(folder, 'goal-rock-atlas.png');
  await atlas(rendered.files.slice(0, 2), GOAL, goalAtlas);
  const goalGif = join(folder, 'goal-rock.gif');
  gif([0, 1, 0, 1].map(idx => ({ file: rendered.files[idx], delay: 24 })), goalGif);
  return {
    sources: [spec.goalLow, spec.goalHigh, spec.reaction].map(s => `assets/characters/source_sheets/${s}`),
    canvas: { width: GOAL.width, height: GOAL.height },
    pivot: rendered.pivot,
    scale: rendered.scale,
    poses: rendered.stats,
    animations: { goalRock: { frames: [0, 1], delayCs: [24, 24], gif: relative(ROOT, goalGif), atlas: relative(ROOT, goalAtlas) }, lookBack: { file: relative(ROOT, join(folder, names[2])), nonLooping: true } }
  };
}

await mkdir(OUTPUT, { recursive: true });
for (const [character, spec] of Object.entries(files)) {
  const entry = {};
  entry.front = await buildSquats(character, 'front', spec.front);
  entry.back = await buildSquats(character, 'back', spec.back);
  entry.goal = await buildGoal(character, spec);
  manifest.characters[character] = entry;
  console.log(`[animation] ${character}: 4 front + 4 back + 2 goal + 1 reaction, 5 previews`);
}
const manifestFile = join(OUTPUT, 'manifest.json');
await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
const shellFile = join(ROOT, 'tools/render-character-gifs.sh');
await writeFile(shellFile,
  '#!/bin/sh\nset -eu\ncd "$(dirname "$0")/.."\n' + gifCommands.join('\n') + '\n');
console.log(`[animation] GIF commands: ${relative(ROOT, shellFile)} (run separately)`);
console.log(`[animation] manifest: ${relative(ROOT, manifestFile)}`);
