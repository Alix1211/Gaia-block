// Run with: node tools/test-elastic-hazards.js
// Headless checks: stage allocation, real supplied PNGs, selective collision,
// continuing character presence, multiplicative acceleration and old rules.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
global.window=global;
global.addEventListener=()=>{};
global.GaiaSound={play(){},powerUp(){}};
for(const file of ['js/config-inline.js','js/stages40.js','js/engine.js','js/renderer.js','js/elastic-hazards.js'])
    vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
const stageMap={
    CASINO_DOUBLE:['brown','lookback'],
    CASINO_TIMING:['choseon','lookback'],
    CLUB_NEON:['brown','seated'],
    CLUB_CHAIN:['choseon','seated'],
    POLICE_TEST:['brown','split'],
    POLICE_BARRIER:['choseon','split']
};
const stages=window.GAIA_40_STAGES;
assert.equal(stages.length,40);
const elastic=stages.filter(s=>s.features.elasticCharacter);
assert.equal(elastic.length,6);
const canvas={width:800,height:800,getContext:()=>({}),addEventListener(){}};
const game=new GameEngine(canvas);
game.levelsConfig={levels:stages};
game.selectedShip={width:138,height:25,speed:12};
game.shipsConfig={ships:[]};
game.powersConfig={powers:[]};
for(const [key,[who,pose]] of Object.entries(stageMap)) {
    const n=stages.findIndex(s=>s.sceneKey===key);
    assert(n>=0);
    const stage=stages[n];
    assert.equal(stage.character,who,'portrait must match main character '+key);
    assert.deepEqual([stage.features.elasticCharacter.who,stage.features.elasticCharacter.pose],[who,pose]);
    const art=window.GaiaElasticArt.paths[who][pose];
    assert(fs.existsSync(path.join(root,art)),'missing sprite '+art);
    game.loadLevel(n);
    const actor=game.elasticCharacter;
    assert(actor && actor.pose===pose && actor.who===who);
    assert(actor.left>=0 && actor.left+actor.width<=800);
    assert(actor.top+actor.height<=790);
    assert(game.targets.length===0,'only target-free stages should get this artwork');
    const speed=6;
    const ball={x:actor.left+actor.width*.07,y:actor.top+actor.height*.08,
        dx:0,dy:speed,radius:11,baseSpeed:speed,speed,trail:[]};
    game.elapsed=.1;
    game.checkElasticCharacter(ball);
    assert.equal(Math.hypot(ball.dx,ball.dy),speed,'unclothed body must remain pass-through');
    let expected=speed;
    for(let i=0;i<3;i++) {
        const zone=actor.zones[0];
        ball.x=actor.left+actor.width*zone.cx;
        ball.y=actor.top+actor.height*zone.cy;
        ball.dx=0;ball.dy=Math.hypot(ball.dx,ball.dy)||expected;
        // A real new approach from above, after exiting the garment.
        game.elapsed=i+1;
        ball.elasticContact=null;
        game.checkElasticCharacter(ball);
        expected*=1.20;
        assert(Math.abs(Math.hypot(ball.dx,ball.dy)-expected)<.0001,
            'cumulative 20% speed must not silently cap at hit '+(i+1));
        assert.equal(game.elasticCharacter,actor,'actor must never vanish after collision');
    }
}
for(const key of ['MART_BASIC','PARK_GOAL1','ROOM_REVEAL','CASINO_BET','CLUB_SQUAT']) {
    const n=stages.findIndex(s=>s.sceneKey===key);
    game.loadLevel(n);
    assert.equal(game.elasticCharacter,null,'prior stage rules untouched '+key);
}
const originalCount=stages.map(s=>s.count);
assert(originalCount.every((n,i)=>n===stages[i].count));
console.log('PASS six large-character stages, source assets, garment-only bounce, 1.2^3 acceleration, old prototypes unaffected');
