// Regression test for native vibration calls from REAL collision code.
// Run: node tools/test-game-haptics.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const signals=[];
const now={value:1000};
const elements=new Map();
function getElementById(id){
  if(!elements.has(id))elements.set(id,{
    id,value:'',checked:false,textContent:'',style:{},dataset:{},
    addEventListener(){},click(){},classList:{add(){},remove(){}}
  });
  return elements.get(id);
}
const native={vibrate(json){signals.push(JSON.parse(json));return true}};
const context=vm.createContext({
    console,JSON,Math,Date,Number,String,Array,Object,Set,Map,
    localStorage:{getItem(){return null},setItem(){}},
    performance:{now:()=>now.value},
    document:{getElementById},
    navigator:{vibrate(){throw new Error('should use DIRECT NATIVE, not navigator')}},
    window:{
      addEventListener(){},GaiaNativeVibration:native,
      GaiaSound:{
        samples:{},makeAudio(){return null},play(){},
        brick(){},paddle(){},voice(){},powerUp(){}
      },
      GAIA_40_STAGES:[]
    }
});
for(const name of ['engine','renderer','elastic-hazards','gaia-options']){
  vm.runInContext(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'),
    context,{filename:name+'.js'});
}
const GameEngine=vm.runInContext('GameEngine',context);
const game=new GameEngine({
  width:800,height:800,
  getContext(){return {}},
  addEventListener(){},style:{}
});
game.spawnPaddleParticles=()=>{};
game.spawnSparkParticles=()=>{};
game.spawnBrickParticles=()=>{};
game.paddle={x:200,y:700,width:140,height:25};
let ball={x:260,y:694,dx:2,dy:6,radius:10};
game.checkPaddleCollision(ball);
assert(ball.dy<0,'paddle must really bounce');
assert.deepEqual(signals.at(-1),[65],'paddle must call maximum-amplitude Android bridge from contact');

now.value+=250;
game.bounceOffBody({x:220,y:300,dx:3,dy:5,radius:10},
  {left:100,width:200},{name:'hip'});
assert.deepEqual(signals.at(-1),[90,35,105],'body reflection must vibrate');

now.value+=400;
game.bricks=[];
game.explodeBrick({x:100,y:100,width:73,height:32},-1);
assert.deepEqual(signals.at(-1),[160,45,180,45,160],'bomb must vibrate');

now.value+=400;
game.levelsConfig={levels:[{features:{}}]};
game.currentLevel=0;game.elapsed=3;game.stageStats={};game.actors=[];
game.targets=[{kind:'soccer',goalArtwork:{},x:400,y:270,width:96,height:58,
    visible:true,required:1,count:0,lastHit:-100,moveAmp:0,character:'brown'}];
const goalBall={x:400,y:266,dx:1,dy:-5,radius:10,baseSpeed:4,speed:4};
game.checkStageTargetCollisions(goalBall,274);
assert.equal(game.targets[0].count,1,'goal should be scored');
assert.deepEqual(signals.at(-1),[90,35,105],'animated goalie collision must vibrate');

now.value+=400;
game.targets=[];game.elapsed=7;
game.elasticCharacter={
    left:0,top:0,width:400,height:500,
    zones:[{cx:.5,cy:.5,rx:.2,ry:.1}],
    lastHit:-1000,triggered:-1000,impactX:0,impactY:0
};
const elasticBall={x:200,y:218,dx:0,dy:5,radius:10,baseSpeed:4};
game.checkElasticCharacter(elasticBall);
assert(elasticBall.dy<0,'elastic body contact must bounce');
assert.deepEqual(signals.at(-1),[90,35,105],'elastic character collision must vibrate');
assert.equal(signals.length,5,'exactly one direct Android signal per real collision');

// Verify sound settings do not disable haptics; vibrate toggle does.
context.window.GaiaHaptics.enabled=false;
const count=signals.length;
context.window.GaiaHaptics.pulse('explosion');
assert.equal(signals.length,count,'disabled vibration should not invoke motor');
assert.equal(typeof GameEngine.prototype.checkPaddleCollision,'function');
console.log('PASS: direct native signals on paddle/body/explosion/goal/elastic, no wrapper geometry false negatives');
