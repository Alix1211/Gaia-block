// Package exact images and audio required by the offline game.
// Stream originals through Android WebView rather than embedding 74MB base64.
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const dest=path.join(root,'android','app','src','main','assets','www');
const images=[
    ...Array.from({length:8},(_,i)=>'assets/backgrounds/stage'+(i+1)+'.png'),
    ...['hero-idle','hero-hit','hero-win','hero-shy'].map(name=>'assets/characters/'+name+'.png'),
    ...['P01_choseon_pink','P02_brown_red'].flatMap(who=>
        [1,2,3,4].map(i=>'assets/characters/cutouts/03_portraits/'+who+'_0'+i+'.png')),
    ...['P03_choseon_royal_01','P05_brown_jacket_01',
        'P06_brown_jacket_cheer','P06_choseon_royal_cheer'].map(file=>
        'assets/characters/cutouts/03_portraits/'+file+'.png'),
    ...['brown_red','choseon_pink'].flatMap(who=>
        [1,2,3,4].map(i=>'assets/characters/cutouts/01_spanking/S0'+i+'_'+who+'_'+(i===4?'bend':'back')+'.png')),
    ...['brown','choseon'].flatMap(who=>
        ['low','high'].map(pose=>'assets/characters/animations/'+who+'/goal/'+pose+'.png')),
    ...['brown','choseon'].flatMap(who=>['','jump/'].flatMap(mode=>
        [0,1,2,3].map(i=>'assets/characters/animations/'+who+'/back/'+mode+'frame_0'+i+'.png'))),
    ...['brown','choseon'].map(who=>'assets/characters/animations/'+who+'/goal/look-back.png'),
    ...['12-1000109497','13-1000109494','14-1000109492','15-1000109491'].map(name=>
        'assets/characters/source_sheets/'+name+'.png'),
    'assets/sprites/balls-paddles.png',
    'assets/sprites/glass-bricks.png',
    ...['01-jelly','02-pink-metal','03-pink-wood','04-neon','05-solid'].flatMap(material=>
        ['long','rect-alt','rect','square'].map(shape=>
            'assets/sprites/gaia-blocks-v1/trimmed/'+material+'-'+shape+'.png'))
];
const audio=[
    ...[90,120,150].map(bpm=>'assets/audio/bgm-'+bpm+'.mp3'),
    ...[1,2,3].map(n=>'assets/audio/slap-'+n+'.mp3'),
    ...['surprise','effort','yelp','whimper','happy','sigh','home-run'].map(name=>
        'assets/audio/voice-'+name+'.mp3')
];
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scriptRefs=[...index.matchAll(/<script\s+src="([^"]+\.js)"/g)].map(m=>m[1]);
const cssRefs=[...index.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+\.css)"/g)].map(m=>m[1]);
const files=[...new Set(['index.html',...scriptRefs,...cssRefs,...images,...audio])];
fs.rmSync(dest,{recursive:true,force:true});
let copied=0;
for(const file of files){
    if(file.startsWith('/') || file.includes('..'))throw new Error('Unsafe asset path: '+file);
    const source=path.join(root,file);
    if(!fs.existsSync(source))throw new Error('Missing original game asset: '+file);
    const output=path.join(dest,file);
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.copyFileSync(source,output);
    copied+=fs.statSync(output).size;
}
console.log(JSON.stringify({fileCount:files.length,bytes:copied,
    output:dest,scriptFiles:scriptRefs.length,imageFiles:images.length,audioFiles:audio.length}));
