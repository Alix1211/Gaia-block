// Offline sound wiring test; uses fake media objects without requiring speakers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const names=[
  ...[90,120,150].map(n=>`bgm-${n}`),
  ...[1,2,3].map(n=>`slap-${n}`),
  ...['surprise','effort','yelp','whimper','happy','sigh','home-run'].map(n=>`voice-${n}`)
];
for(const name of names){
  const file=path.join(root,'assets/audio',name+'.mp3');
  assert(fs.statSync(file).size>100,`Missing audio: ${name}`);
}
class MockAudio {
  constructor(src){this.src=src;this.playCount=0;this.paused=true;this.currentTime=0;this.volume=1;this.loop=false;}
  play(){this.paused=false;this.playCount++;return Promise.resolve();}
  pause(){this.paused=true;}
}
const window={};
const sandbox=vm.createContext({window,Audio:MockAudio,Date,setTimeout,clearTimeout,setInterval,clearInterval});
vm.runInContext(fs.readFileSync(path.join(root,'js/gaia-sound.js'),'utf8'),sandbox);
const sound=window.GaiaSound;
sound.start(0);
assert.equal(sound.currentBpm,90);
assert.equal(sound.music.playCount>=1,true);
sound.brick(1);
assert.equal(sound.samples['slap-1'].playCount,1);
sound.voice('surprise',true);
assert.equal(sound.samples['voice-surprise'].playCount,1);
sound.pause();
assert.equal(sound.music.paused,true);
sound.setEnabled(false);
sound.setEnabled(true);
assert.equal(sound.music.paused,true,'Unmuting during pause must not resume BGM');
sound.resume();
assert.equal(sound.music.paused,false);
sound.setStage(10);
assert.equal(sound.currentBpm,120);
sound.setStage(25);
assert.equal(sound.currentBpm,150);
sound.setEnabled(false);
assert.equal(sound.music.paused,true);
sound.setEnabled(true);
assert.equal(sound.music.paused,false);
sound.stop();
assert.equal(sound.music,null);
console.log(JSON.stringify({result:'PASS',bgm:'90/120/150 BPM',brick:'sample',voice:'sample',pause:true,mute:true,offline:true}));
