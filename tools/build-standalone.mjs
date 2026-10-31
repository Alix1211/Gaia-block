// Mechanically packages the tested multi-file game into one fully offline HTML.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(base,'..','GAIA_Heart_Breaker_v0.10.1_ClearFix_Standalone.html');
const images=[
    ...Array.from({length:8},(_,i)=>`assets/backgrounds/stage${i+1}.png`),
    ...['hero-idle','hero-hit','hero-win','hero-shy'].map(name=>`assets/characters/${name}.png`),
    'assets/sprites/balls-paddles.png',
    'assets/sprites/glass-bricks.png'
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
const scripts=['config-inline','gaia-sound','engine','sprite-atlas','renderer','main'];
for(const name of scripts){
    const target=`<script src="js/${name}.js"></script>`;
    if(!html.includes(target))throw new Error(`Missing entry: ${name}`);
    const js=fs.readFileSync(path.join(base,'js',name+'.js'),'utf8');
    html=html.replace(target,`<script>\n${js}\n</script>`);
}
fs.writeFileSync(output,html);
console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),images:images.length,audio:audio.length,scripts:scripts.length}));
