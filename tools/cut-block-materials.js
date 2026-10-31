#!/usr/bin/env node
// Deterministic, redraw-free cropping of the approved 5x4 block concept atlas.
const path = require('path');
const fs = require('fs');
const {execFileSync} = require('child_process');

const root = path.resolve(__dirname, '..');
const input = path.join(root, 'assets/concepts/gaia-bricks-materials-v1.png');
const outDir = path.join(root, 'assets/sprites/gaia-blocks-v1');
const families = ['jelly', 'pink-metal', 'pink-wood', 'neon', 'solid'];
const forms = ['rect', 'square', 'long', 'rect-alt'];
const colCuts = [0, 390, 615, 1170, 1536];
const rowCuts = [0, 227, 422, 626, 812, 1024];
function runConvert(args) {
  try { execFileSync('convert', args); }
  catch (error) {
    // Some sandboxed ImageMagick processes report EPERM while their child
    // nevertheless completed successfully with exit status 0.
    if (error.status !== 0) throw error;
  }
}

fs.mkdirSync(outDir, {recursive:true});
for (let row=0; row<5; row++) {
  for (let col=0; col<4; col++) {
    const x=colCuts[col], y=rowCuts[row];
    const w=colCuts[col+1]-x, h=rowCuts[row+1]-y;
    const file=path.join(outDir,`${String(row+1).padStart(2,'0')}-${families[row]}-${forms[col]}.png`);
    runConvert([input,'-crop',`${w}x${h}+${x}+${y}`,'+repage',
      '-trim','+repage','-define','png:compression-level=0',file]);
    runConvert([file,'-resize','1x1','null:']);
    console.log(path.basename(file));
  }
}
