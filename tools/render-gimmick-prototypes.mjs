/** Visual QA for three script-first gimmick prototypes, not difficulty maps.
 * Run: node tools/render-gimmick-prototypes.mjs
 * The image captures the ACTUAL engine + renderer using existing supplied art.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {createCanvas,Image}=require('@napi-rs/canvas');
const sharp=require('sharp');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
class LocalImage extends Image {
    set src(value) {
        if(typeof value==='string'&&value.startsWith('assets/'))
            super.src=fs.readFileSync(path.join(root,value));
        else super.src=value;
    }
    get src(){return super.src;}
}
const window={addEventListener(){},GaiaAssetUrl:p=>p,GaiaSound:{}};
const document={createElement:name=>name==='canvas'?createCanvas(1,1):null};
const context=vm.createContext({window,document,Image:LocalImage,console,Math});
for(const name of ['config-inline','stages40','engine','sprite-atlas','block-sprites','renderer'])
    vm.runInContext(fs.readFileSync(path.join(root,'js',`${name}.js`),'utf8'),context,{filename:name});
const GameEngine=vm.runInContext('GameEngine',context);
const Renderer=vm.runInContext('Renderer',context);
await Promise.all(Object.values(window.GaiaBlocks.sprites).flatMap(Object.values).map(img=>img.decode()));
const outputDir=path.join(root,'docs','previews');
fs.mkdirSync(outputDir,{recursive:true});
const pictures=[];
for(const [sceneKey,stageNumber,mode] of [
    ['PARK_GOAL1',6,'goal'],['ROOM_REVEAL',11,'reveal'],['CASINO_BET',21,'hop']
]) {
    const index=window.GAIA_40_STAGES.findIndex(s=>s.sceneKey===sceneKey);
    if(index!==stageNumber-1)throw new Error(`Wrong script stage number: ${sceneKey}=${index+1}`);
    const canvas=createCanvas(800,800);canvas.addEventListener=()=>{};
    const engine=new GameEngine(canvas);
    engine.levelsConfig={levels:window.GAIA_40_STAGES};
    engine.shipsConfig=window.GAIA_CONFIGS.ships;
    engine.powersConfig=window.GAIA_CONFIGS.powers;
    engine.selectedShip={...engine.shipsConfig.ships[1],width:138,height:25};
    engine.loadLevel(index);engine.state='playing';
    const renderer=new Renderer(engine);
    await Promise.all([...Object.values(renderer.goalCharacters),
        ...Object.values(renderer.bodyCharacters)].map(img=>img.decode()));
    const backdrop=new LocalImage();backdrop.src=`assets/backgrounds/stage${engine.levelsConfig.levels[index].chapter+1}.png`;
    await backdrop.decode();
    const baseRender=renderer.background.bind(renderer);
    renderer.background=()=>{
        canvas.getContext('2d').drawImage(backdrop,0,0,800,800);
        baseRender();
    };
    for(const [variant,elapsed] of [['pose-a',0],['pose-b',mode==='hop'?1.3:mode==='reveal'?1.1:.27]]) {
        engine.elapsed=elapsed;engine.updateStageTargets();
        renderer.render();
        const png=canvas.toBuffer('image/png');
        const file=`prototype-stage-${String(stageNumber).padStart(2,'0')}-${variant}.png`;
        fs.writeFileSync(path.join(outputDir,file),png);
        pictures.push({number:stageNumber,mode,variant,png});
    }
}
const title=(stage,mode,pose)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="56"><rect width="800" height="56" fill="#38223f"/><text x="400" y="37" fill="#fff0fa" font-family="sans-serif" font-size="26" font-weight="bold" text-anchor="middle">STAGE ${stage} — ${mode.toUpperCase()} / ${pose.toUpperCase()}</text></svg>`);
const tiles=[];
for(const [i,p] of pictures.entries()) {
    const tile=await sharp({create:{width:800,height:856,channels:4,background:'#38223f'}})
        .composite([{input:title(p.number,p.mode,p.variant),left:0,top:0},{input:p.png,left:0,top:56}]).png().toBuffer();
    tiles.push({input:tile,left:(Math.floor(i/2))*800,top:(i%2)*856});
}
const contact=path.join(outputDir,'PROTOTYPES_06_11_21.png');
await sharp({create:{width:2400,height:1712,channels:4,background:'#38223f'}})
    .composite(tiles).png().toFile(contact);
const reviewJpeg=path.join(outputDir,'PROTOTYPES_06_11_21.jpg');
await sharp(contact).resize({width:1200}).jpeg({quality:52,mozjpeg:true}).toFile(reviewJpeg);
console.log(JSON.stringify({contact:path.relative(root,contact),review:path.relative(root,reviewJpeg),
    stages:pictures.map(p=>p.number)}));
