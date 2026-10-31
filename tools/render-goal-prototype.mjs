/** Render the actual level, collisions and sprite frames without a browser.
 * Run: node tools/render-goal-prototype.mjs
 * This is a faithful 800x800 game-canvas capture, not a claim of device QA.
 */
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {createCanvas,Image}=require('@napi-rs/canvas');
const sharp=require('sharp');
const base=process.cwd();

class FileImage extends Image {
  set src(value) {
    this.file=value;
    super.src=fs.readFileSync(path.join(base,value));
  }
  get src() { return this.file; }
}

const window={addEventListener(){},GaiaSound:{}};
const sandbox=vm.createContext({window,Image:FileImage,console,Math});
for(const name of ['config-inline','stages40','block-sprites','engine','renderer']) {
  vm.runInContext(fs.readFileSync(path.join(base,'js',name+'.js'),'utf8'),sandbox,{filename:name+'.js'});
}
const GameEngine=vm.runInContext('GameEngine',sandbox);
const Renderer=vm.runInContext('Renderer',sandbox);
const canvas=createCanvas(800,800);
const wrapper={width:800,height:800,getContext:()=>canvas.getContext('2d'),addEventListener(){},style:{}};
const engine=new GameEngine(wrapper);
await engine.loadConfigs();
engine.levelsConfig.levels=window.GAIA_40_STAGES;
engine.selectedShip={...engine.shipsConfig.ships[1],width:138,height:25};
const index=engine.levelsConfig.levels.findIndex(stage=>stage.sceneKey==='PARK_GOAL1');
if(index<0)throw new Error('PARK_GOAL1 missing');
engine.loadLevel(index);
engine.state='playing';
const renderer=new Renderer(engine);
// Canvas image decoding completes asynchronously even when Image.src is set
// from an in-memory PNG; wait before capturing the first pose.
await new Promise(resolve=>setTimeout(resolve,150));
const dir=path.join(base,'docs','previews');
await mkdir(dir,{recursive:true});
const generated=[];
for(const [name,seconds] of [['low',0],['high',.27]]) {
  engine.elapsed=seconds;
  engine.updateStageTargets();
  renderer.render();
  const overlay=canvas.toBuffer('image/png');
  const backdrop=await sharp(path.join(base,'assets/backgrounds/stage2.png')).resize(800,800,{fit:'cover'}).png().toBuffer();
  const screenshot=await sharp(backdrop).composite([{input:overlay}]).png().toBuffer();
  const file=path.join(dir,`PARK_GOAL1_${name}.png`);
  await writeFile(file,screenshot);
  generated.push(screenshot);
}
const label=text=>Buffer.from(`<svg width="800" height="55" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="55" fill="#412442"/><text x="400" y="36" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="28" fill="#ffe4ef">${text}</text></svg>`);
const labeled=[];
for(let i=0;i<generated.length;i++) {
  labeled.push(await sharp({create:{width:800,height:855,channels:4,background:'#402842'}})
    .composite([{input:label(i?'HIGH POSE  ·  MOVING GOAL':'LOW POSE  ·  MOVING GOAL'),left:0,top:0},{input:generated[i],left:0,top:55}]).png().toBuffer());
}
const contact=path.join(dir,'PARK_GOAL1_two-poses.png');
await sharp({create:{width:1600,height:855,channels:4,background:'#402842'}})
  .composite(labeled.map((input,i)=>({input,left:i*800,top:0}))).png().toFile(contact);
console.log(JSON.stringify({stage:index+1,files:[...['low','high'].map(s=>`docs/previews/PARK_GOAL1_${s}.png`),'docs/previews/PARK_GOAL1_two-poses.png']}));
