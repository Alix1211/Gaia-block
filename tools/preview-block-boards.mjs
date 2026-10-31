// Optional visual QA: render real stage layouts with the real renderer, without
// requiring Chromium. Saves PNGs under /tmp; never alters source art.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const {createCanvas,Image}=require('@napi-rs/canvas');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
class LocalImage extends Image {
    set src(value) {
        if(typeof value==='string' && value.startsWith('assets/')) {
            super.src=fs.readFileSync(path.join(root,value));
        } else super.src=value;
    }
    get src() { return super.src; }
}
const window={addEventListener(){},GaiaAssetUrl:p=>p};
const document={createElement:name=>name==='canvas'?createCanvas(1,1):null};
const context=vm.createContext({window,document,Image:LocalImage,console,Math});
for(const name of ['config-inline','stages40','engine','sprite-atlas','block-sprites','renderer']) {
    vm.runInContext(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'),context,{filename:name});
}
const GameEngine=vm.runInContext('GameEngine',context);
const Renderer=vm.runInContext('Renderer',context);
// In the native canvas preview, assigning image bytes and decoding them are
// separate steps. Browser Image elements handle the decoding automatically.
await Promise.all(Object.values(window.GaiaBlocks.sprites).flatMap(Object.values).map(i=>i.decode()));
const indices=[0,2,4,8,24,31,39];
for(const index of indices) {
    const canvas=createCanvas(800,800);
    canvas.addEventListener=()=>{};
    const engine=new GameEngine(canvas);
    engine.levelsConfig={levels:window.GAIA_40_STAGES};
    engine.shipsConfig=window.GAIA_CONFIGS.ships;
    engine.powersConfig=window.GAIA_CONFIGS.powers;
    engine.selectedShip=window.GAIA_CONFIGS.ships.ships[1];
    engine.loadLevel(index);
    engine.state='playing';
    const renderer=new Renderer(engine);
    const background=new LocalImage();
    background.src=`assets/backgrounds/stage${Math.floor(index/5)+1}.png`;
    await background.decode();
    const originalBackground=renderer.background.bind(renderer);
    renderer.background=()=>{
        const c=canvas.getContext('2d');
        c.drawImage(background,0,0,800,800);
        originalBackground();
    };
    renderer.render();
    const output=path.join(os.tmpdir(),`gaia-stage-${String(index+1).padStart(2,'0')}-blocks.png`);
    fs.writeFileSync(output,canvas.toBuffer('image/png'));
    console.log(output);
}

// Material hit-state contact sheet: verify that grayscale neon, jelly
// deformation, metal cracking and recolor are actually drawn by the renderer.
{
    const canvas=createCanvas(790,450);
    canvas.addEventListener=()=>{};
    const engine=new GameEngine(canvas);
    engine.levelsConfig={levels:window.GAIA_40_STAGES};
    const renderer=new Renderer(engine);
    const c=canvas.getContext('2d');
    c.fillStyle='#342944';c.fillRect(0,0,790,450);
    const rows=[['solid',1],['wood',1],['jelly',2],['metal',3],['neon',2]];
    for(let r=0;r<rows.length;r++) {
        const [material,maxHits]=rows[r];
        const y=38+r*82;
        c.fillStyle='#fff';c.font='bold 19px sans-serif';c.fillText(material,12,y+21);
        for(let hit=0;hit<maxHits;hit++) {
            const x=132+hit*168;
            renderer.gaiaBrick({x,y,width:115,height:50,material,
                spriteVariant:'rect',mark:null,maxHits,hits:maxHits-hit,
                jewelShade:hit%3,indestructible:false});
            c.fillStyle='#eee';c.font='14px sans-serif';
            c.fillText(`${hit} hit(s)`,x,y-7);
        }
    }
    const output=path.join(os.tmpdir(),'gaia-block-hit-states.png');
    fs.writeFileSync(output,canvas.toBuffer('image/png'));
    console.log(output);
}
