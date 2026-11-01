// Offline UI event smoke test with a small DOM/Canvas mock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const events={};
const noop=()=>{};
const gradient={addColorStop:noop};
const ctx=new Proxy({}, {get(o,k){if(k==='createLinearGradient'||k==='createRadialGradient')return()=>gradient;return o[k]??noop;},set(o,k,v){o[k]=v;return true;}});
const els=new Map();
function element(id){
  if(els.has(id))return els.get(id);
  const listeners={};
  const classes=new Set();
  const e={id,textContent:'',src:'',dataset:{},style:{},hidden:false,offsetWidth:123,
    setAttribute(name,value){this[name]=value;},
    classList:{add:s=>classes.add(s),remove:s=>classes.delete(s),contains:s=>classes.has(s),toggle(s,bool){if(bool)classes.add(s);else classes.delete(s);}},
    addEventListener:(name,fn)=>listeners[name]=fn,
    click:()=>listeners.click?.(),
    getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:800,height:800})};
  if(id==='gameCanvas'){
    e.width=800;e.height=800;
    e.addEventListener=(name,fn)=>events[name]=fn;
  }
  els.set(id,e);return e;
}
class MockImage{constructor(){this.complete=false;this.naturalWidth=0;this.width=0;this.height=0;}set src(v){this._src=v;}get src(){return this._src;}}
const window={addEventListener:noop};
const document={getElementById:element,addEventListener:noop};
const saved=new Map();
const localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
const context=vm.createContext({window,document,Image:MockImage,localStorage,console,performance:{now:()=>1000},requestAnimationFrame:()=>1,cancelAnimationFrame:noop,setTimeout,clearTimeout,setInterval,clearInterval});
const scripts=['config-inline','stages40','dialogues-data','gaia-sound','engine','sprite-atlas','block-sprites','renderer','elastic-hazards','main'];
for(const name of scripts)vm.runInContext(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'),context);
await new Promise(resolve=>setImmediate(resolve));
const e=window.gaiaTestEngine;
assert(e,'Game did not start');
assert.equal(e.state,'menu');
element('goalDemoButton').click();
assert.equal(e.levelsConfig.levels[e.currentLevel].sceneKey,'PARK_GOAL1','Goal showcase must start the right level');
assert(e.targets[0]?.goalArtwork,'Goal showcase is missing the animated target');
assert.equal(e.currentLevel,5,'Script stage 06 must be the playable stage 06');
assert.equal(e.state,'dialogue','Intro freezes the prototype until acknowledged');
assert(element('heroImage').src.includes('P03_choseon_royal_01'),'Dressed intro must use the supplied portrait');
element('dialogueStart').click();
assert.equal(e.state,'playing');
assert(element('heroImage').src.includes('P01_choseon_pink_01'),'Costume swaps to the original play portrait');
e.targets[0].count=e.targets[0].required;
e.bricks=e.bricks.filter(b=>b.indestructible).concat(e.bricks.filter(b=>!b.indestructible).slice(0,
  Math.floor(e.stageStats.total*(1-e.levelsConfig.levels[e.currentLevel].clear))));
e.update(16.67);
assert.equal(e.state,'levelComplete','Goal demo does not complete');
assert(element('heroImage').src.includes('P06_choseon_royal_cheer'),
  'Result must use the supplied clothed celebration artwork');
element('resultButton').click();
assert.equal(e.state,'menu','Showcase must return to the menu');
assert(element('continueButton').hidden,'Showcase may not unlock unfinished main stages');
for(const [button,key,index] of [['revealDemoButton','ROOM_REVEAL',10],['hopDemoButton','CASINO_BET',20]]){
  element(button).click();
  assert.equal(e.currentLevel,index,`${key} must have its dialogue stage number`);
  assert.equal(e.levelsConfig.levels[e.currentLevel].sceneKey,key);
  assert.equal(e.state,'dialogue');
  assert(element('heroImage').src.includes('P05_brown_jacket_01'),
    'Other prototype intros must use the existing clothed portrait');
  element('dialogueStart').click();
  assert.equal(e.state,'playing');
  assert(element('heroImage').src.includes('P02_brown_red_01'),
    'Other prototype gameplay must use existing play portrait');
  element('pauseButton').click();element('pauseHome').click();
  assert.equal(e.state,'menu');
}
element('startButton').click();
assert.equal(e.state,'dialogue');
assert.equal(e.currentLevel,5,'GAME START must begin at stage 06, not stage 01');
assert.equal(e.levelsConfig.levels[e.currentLevel].sceneKey,'PARK_GOAL1');
assert(e.ballAttached);
assert(!element('dialogueScreen').classList.contains('hidden'),'Opening dialogue overlay missing');
element('hardcoreMode').click();
assert.equal(localStorage.getItem('gaia-heart-breaker-dialogue-mode-v1'),'hardcore');
assert(element('dialogueMale').textContent.includes('암캐'),'User-provided dialogue not selected');
element('dialogueStart').click();
assert.equal(e.state,'playing');
element('settingsButton').click();
assert.equal(e.state,'paused','Settings must freeze game');
element('settingsClose').click();
assert.equal(e.state,'playing');
assert(element('dialogueScreen').classList.contains('hidden'));
events.touchstart({preventDefault:noop,touches:[{clientX:400,clientY:720}]});
assert(!e.ballAttached,'Tap failed to launch ball');
element('pauseButton').click();
assert.equal(e.state,'paused');
element('resumeButton').click();
assert.equal(e.state,'playing');
e.targets.forEach(t=>t.count=t.required);
e.bricks=[];
e.update(16.67);
assert(!element('messageScreen').classList.contains('hidden'),'Stage clear must show results before canvas rendering');
e.render();
assert.equal(e.state,'levelComplete');
assert(!element('messageScreen').classList.contains('hidden'),'Stage completion overlay missing');
assert.equal(element('resultButton').textContent,'다음 기믹 ▶');
element('resultButton').click();
assert.equal(e.currentLevel,10,'Stage 06 clear must go to 11, not 07');
assert.equal(e.levelsConfig.levels[e.currentLevel].sceneKey,'ROOM_REVEAL');
assert.equal(e.state,'dialogue');
element('dialogueStart').click();
assert.equal(e.state,'playing');
// Loss should open the result immediately as well, even when no next render occurs.
e.lives=1;
e.loseLife();
assert.equal(e.state,'gameOver');
assert(!element('messageScreen').classList.contains('hidden'),'Game over result overlay missing');
element('resultButton').click();
assert.equal(e.state,'dialogue','Game over retry must open its dialogue');
assert.equal(e.currentLevel,10,'Game over retries the same prototype');
element('dialogueStart').click();
assert.equal(e.state,'playing','Game over retry button failed');
// A drawing exception must not permanently terminate requestAnimationFrame.
const originalRender=e.render;
e.render=()=>{throw new Error('mock canvas failure');};
e.gameLoop(e.lastTime+16.67);
assert.equal(e.animationFrame,1,'Game loop stopped after a renderer exception');
e.render=originalRender;
e.targets.forEach(t=>t.count=t.required);
e.bricks=[];
e.update(16.67);
assert.equal(e.state,'levelComplete');
element('resultButton').click();
assert.equal(e.currentLevel,20,'Stage 11 clear must go to 21, not 12');
assert.equal(e.levelsConfig.levels[e.currentLevel].sceneKey,'CASINO_BET');
assert.equal(e.state,'dialogue');
element('dialogueStart').click();
assert.equal(e.state,'playing');
e.bricks=[];
e.update(16.67);
assert.equal(e.state,'levelComplete');
assert.equal(element('resultButton').textContent,'3종 시범 종료 · 메인으로');
element('resultButton').click();
assert.equal(e.state,'menu');
assert(element('continueButton').hidden,'Unbalanced 40-round continue must not interfere with the demo');
assert.equal(e.currentLevel,5,'Main menu preview must point at the first playable gimmick');
// The optional six-pose route must be accessible without unlocking 40 rounds.
element('elasticDemoButton').click();
assert.equal(e.currentLevel,21,'elastic test should begin at real stage 22');
assert.equal(e.elasticCharacter?.pose,'lookback','large actor missing from stage 22');
assert.equal(e.elasticCharacter?.who,'brown');
assert.equal(e.state,'dialogue');
assert(element('heroImage').src.includes('P05_brown_jacket_01'),
  'pose tour introduction must use the matching dressed character');
element('dialogueStart').click();
assert.equal(e.state,'playing');
e.bricks=[];
e.update(16.67);
assert.equal(e.state,'levelComplete');
assert.equal(element('resultButton').textContent,'다음 숨은 캐릭터 ▶');
element('resultButton').click();
assert.equal(e.currentLevel,23,'stage 22 must advance directly to pose test 24');
assert.equal(e.elasticCharacter?.who,'choseon');
assert.equal(e.state,'dialogue');
element('pauseHome').click(); // The home action returns to the main menu even from a dialogue.
console.log(JSON.stringify({result:'PASS',singleShowcase:true,prototypeTour:'06→11→21→menu',
  startSkips01:true,touchLaunch:true,pauseResume:true,stageClearWithoutRender:true,
  gameOverRetry:true,renderErrorRecovery:true,progressPreserved:true}));
