// Mechanically packages the tested multi-file game into one fully offline HTML.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(base,'..','GAIA_Heart_Breaker_v0.14.0_Elastic_Pose_Tour_Standalone.html');
const images=[
    ...Array.from({length:8},(_,i)=>`assets/backgrounds/stage${i+1}.png`),
    ...['hero-idle','hero-hit','hero-win','hero-shy'].map(name=>`assets/characters/${name}.png`),
    ...['P01_choseon_pink','P02_brown_red'].flatMap(who=>[1,2,3,4].map(i=>
        `assets/characters/cutouts/03_portraits/${who}_0${i}.png`)),
    ...['P03_choseon_royal_01','P05_brown_jacket_01',
        'P06_brown_jacket_cheer','P06_choseon_royal_cheer'].map(file=>
        `assets/characters/cutouts/03_portraits/${file}.png`),
    ...['brown_red','choseon_pink'].flatMap(who=>[1,2,3,4].map(i=>
        `assets/characters/cutouts/01_spanking/S0${i}_${who}_${i===4?'bend':'back'}.png`)),
    ...['brown','choseon'].flatMap(who=>['low','high'].map(pose=>
        `assets/characters/animations/${who}/goal/${pose}.png`)),
    ...['brown','choseon'].flatMap(who=>['','jump/'].flatMap(mode=>
        [0,1,2,3].map(i=>`assets/characters/animations/${who}/back/${mode}frame_0${i}.png`))),
    ...['brown','choseon'].map(who=>`assets/characters/animations/${who}/goal/look-back.png`),
    ...['12-1000109497','13-1000109494','14-1000109492','15-1000109491'].map(name=>
        `assets/characters/source_sheets/${name}.png`),
    'assets/sprites/balls-paddles.png',
    'assets/sprites/glass-bricks.png',
    ...['01-jelly','02-pink-metal','03-pink-wood','04-neon','05-solid'].flatMap(material=>
        ['long','rect-alt','rect','square'].map(shape=>
            `assets/sprites/gaia-blocks-v1/trimmed/${material}-${shape}.png`))
];
const audio=[
    ...[90,120,150].map(bpm=>`assets/audio/bgm-${bpm}.mp3`),
    ...[1,2,3].map(n=>`assets/audio/slap-${n}.mp3`),
    ...['surprise','effort','yelp','whimper','happy','sigh','home-run'].map(name=>`assets/audio/voice-${name}.mp3`)
];
const map=Object.fromEntries([...images,...audio].map(name=>{
    const raw=fs.readFileSync(path.join(base,name));
    const mime=name.endsWith('.png')?'image/png':'audio/mpeg';
    return [name,`data:${mime};base64,${raw.toString('base64')}`];
}));
let html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const css=fs.readFileSync(path.join(base,'css/style.css'),'utf8')
    .replaceAll('../assets/backgrounds/stage1.png',map['assets/backgrounds/stage1.png']);
html=html.replace('<link rel="stylesheet" href="css/style.css">',`<style>\n${css}\n</style>`);
html=html.replace('src="assets/characters/hero-idle.png"',`src="${map['assets/characters/hero-idle.png']}"`);
const assetMapScript=`<script>\nwindow.GaiaAssetMap=${JSON.stringify(map)};\nwindow.GaiaAssetUrl=function(path){return window.GaiaAssetMap[path]||path;};\n</script>`;
html=html.replace('  <script src="js/config-inline.js"></script>',`  ${assetMapScript}\n  <script src="js/config-inline.js"></script>`);
const scripts=['config-inline','stages40','dialogues-data','gaia-sound','engine','sprite-atlas','block-sprites','renderer','elastic-hazards','main'];
for(const name of scripts){
    const target=`<script src="js/${name}.js"></script>`;
    if(!html.includes(target))throw new Error(`Missing entry: ${name}`);
    const js=fs.readFileSync(path.join(base,'js',name+'.js'),'utf8');
    html=html.replace(target,`<script>\n${js}\n</script>`);
}
fs.writeFileSync(output,html);
console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),images:images.length,audio:audio.length,scripts:scripts.length}));
