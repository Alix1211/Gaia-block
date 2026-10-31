// No browser, network, image or audio dependencies. Run: node tools/test-stages40.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
global.window=global;
global.GaiaSound={brick(){},powerUp(){},lose(){}};
for(const file of ['js/config-inline.js','js/stages40.js','js/dialogues-data.js','js/engine.js'])
    vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});

const ctx={};
const canvas={width:800,height:800,getContext:()=>ctx,addEventListener(){},style:{}};
global.addEventListener=()=>{};
const game=new GameEngine(canvas);
game.levelsConfig=window.GAIA_CONFIGS.levels;
game.levelsConfig.levels=window.GAIA_40_STAGES;
game.shipsConfig=window.GAIA_CONFIGS.ships;
game.powersConfig=window.GAIA_CONFIGS.powers;
game.selectedShip={...game.shipsConfig.ships[1],id:'gaia',width:138,height:25};
assert.equal(game.levelsConfig.levels.length,40);
assert.equal(Object.keys(window.GAIA_DIALOGUES.normal).length,40);
assert.equal(Object.keys(window.GAIA_DIALOGUES.hardcore).length,40);
for(const material of ['01-jelly','02-pink-metal','03-pink-wood','04-neon','05-solid']) {
    for(const variant of ['rect','rect-alt','square','long']) {
        const image=path.join(root,'assets/sprites/gaia-blocks-v1/trimmed',`${material}-${variant}.png`);
        assert(fs.existsSync(image),`missing prepared art: ${image}`);
    }
}
const sceneKeys=new Set();
const sceneIndex=key=>game.levelsConfig.levels.findIndex(stage=>stage.sceneKey===key);
const loadScene=key=>{
    const index=sceneIndex(key);
    assert(index>=0,`missing scene ${key}`);
    game.loadLevel(index);
};
for(let tier=0;tier<5;tier++) {
    const batch=game.levelsConfig.levels.slice(tier*8,(tier+1)*8);
    assert.equal(new Set(batch.map(stage=>stage.chapter)).size,8,`every venue visited at difficulty ${tier+1}`);
    assert(batch.every(stage=>stage.tier===tier+1),`difficulty batch ${tier+1}`);
}
for(let n=0;n<40;n++) {
    const stage=game.levelsConfig.levels[n];
    game.loadLevel(n);
    assert.equal(stage.stageId,n+1);
    assert(stage.chapter>=0 && stage.chapter<8);
    assert.equal(stage.tier,Math.floor(n/8)+1);
    assert(!sceneKeys.has(stage.sceneKey),`duplicate scene ${stage.sceneKey}`);
    sceneKeys.add(stage.sceneKey);
    assert(window.GAIA_DIALOGUES.normal[stage.sceneKey]);
    assert(window.GAIA_DIALOGUES.hardcore[stage.sceneKey]);
    const blocks=game.bricks.filter(b=>!b.indestructible);
    assert.equal(blocks.length,stage.count,`stage ${n+1} block count`);
    assert(blocks.every(b=>['rect','rect-alt','square'].includes(b.spriteVariant)),`stage ${n+1} art shapes`);
    assert(blocks.every(b=>b.height===32 && (b.width===73||b.width===34)),`stage ${n+1} sprite/hitbox sizing`);
    assert(blocks.every(b=>!b.mark || (b.spriteVariant==='square' && b.width===34)),`stage ${n+1} special art sizing`);
    assert.equal(game.stageStats.total,blocks.length);
    assert.equal(game.targets.length,Object.values(stage.objectives).filter(Array.isArray).reduce((sum,list)=>sum+list.length,0));
    assert(game.bricks.every(b=>b.x>=0 && b.x+b.width<=800),'horizontal brick bounds');
    assert(game.bricks.every(b=>b.y>=0 && b.y+b.height<750),'brick/paddle separation');
    // Every target is accessible on the board, and initially incomplete.
    assert(game.targets.every(t=>t.x-t.width/2>=0 && t.x+t.width/2<=800));
    assert(!game.stageIsComplete(),'premature clear');
    game.state='playing';
    game.updateStageTargets();
    assert.equal(game.stageIsComplete(),false);
    // Simulate valid physical passes through each target, including direction.
    for(const t of game.targets) {
        for(let j=0;j<t.required;j++) {
            // Hidden targets unlock after enough bricks are removed.
            if(!t.visible) {
                const keep=Math.floor(game.stageStats.total*(1-(stage.features.reveal||stage.clear)));
                game.bricks=game.bricks.filter(b=>b.indestructible).concat(blocks.slice(0,keep));
                game.updateStageTargets();
            }
            t.lastHit=-100;
            const down=t.kind==='basket';
            const ball={x:t.x,y:t.y+(down?1:-1)*3,dy:down?5:-5,dx:2,radius:11,speed:stage.ballSpeed,baseSpeed:stage.ballSpeed};
            game.checkStageTargetCollisions(ball,t.y+(down?-1:1)*3);
            assert.equal(t.count,j+1,`goal register ${n+1} ${t.id}`);
        }
    }
    game.bricks=game.bricks.filter(b=>b.indestructible);
    game.updateStageTargets();
    for (const [key,required] of Object.entries(stage.objectives)) {
        if(!Array.isArray(required)) game.stageStats.chains[key]=required;
    }
    assert(game.stageIsComplete(),`stage ${n+1} clear conditions`);
    game.update(16.67);
    assert.equal(game.state,n===39?'victory':'levelComplete',`stage ${n+1} result`);
}
// Material-specific physical behavior and collision damage.
loadScene('MART_BASIC');
const solid=game.bricks.find(b=>b.material==='solid');
assert(solid?.hits===1);
game.damageBrick(solid);
assert(!game.bricks.includes(solid),'solid must break in one hit');
const wood=game.bricks.find(b=>b.material==='wood');
assert(wood?.hits===1);
game.damageBrick(wood);
assert(!game.bricks.includes(wood),'wood must break and emit particles');
loadScene('MART_JELLY');
const jelly=game.bricks.find(b=>b.material==='jelly');
assert(jelly);
const ball={dx:2,dy:3,radius:11,speed:4,baseSpeed:4};
game.damageBrick(jelly,1,'ball',ball);
assert.equal(jelly.hits,1);
assert(Math.hypot(ball.dx,ball.dy)>Math.hypot(2,3));
game.damageBrick(jelly,1,'ball',ball);
assert(!game.bricks.includes(jelly));
loadScene('MART_METAL');
const metal=game.bricks.find(b=>b.material==='metal');
assert(metal?.hits===3);
game.damageBrick(metal);
assert.equal(metal.hits,2);
game.damageBrick(metal);
assert.equal(metal.hits,1);
game.damageBrick(metal);
assert(!game.bricks.includes(metal),'metal must break on its third hit');
loadScene('CLUB_NEON');
const neon=game.bricks.find(b=>b.material==='neon');
assert(neon && neon.hits===2);
game.damageBrick(neon);
assert.equal(neon.hits,1);
game.damageBrick(neon);
assert(!game.bricks.includes(neon),'neon must break on its second hit');
loadScene('CASINO_BET');
const moving=game.bricks.find(b=>b.indestructible);
assert(moving?.moveAmp>0);
assert.equal(moving.spriteVariant,'long');
assert.equal(moving.width,130);
const count=game.stageStats.total;
game.damageBrick(moving);
assert.equal(game.stageStats.total,count);
assert(game.bricks.includes(moving));
loadScene('MART_BOMB');
const bomb=game.bricks.find(b=>b.mark==='bomb' && game.bricks.some(q=>
    q!==b && q.mark==='bomb' && Math.hypot(q.x-b.x,q.y-b.y)<118));
assert(bomb,'stage 4 adjacent bombs');
game.damageBrick(bomb,bomb.hits);
assert(game.stageStats.chains.bombChain>=1,'stage 4 bomb chain can trigger');
loadScene('MART_FINALE');
const recolor=game.bricks.find(b=>b.mark==='recolor');
assert(recolor && recolor.hits>=3);
const oldShade=recolor.jewelShade;
game.damageBrick(recolor);
assert.equal(recolor.jewelShade,(oldShade+1)%3);
assert(game.bricks.includes(recolor),'recolor block survives first hit');
const quickBomb=game.bricks.filter(b=>b.mark==='bomb').sort((a,b)=>
    game.bricks.filter(q=>Math.hypot(q.x-a.x,q.y-a.y)<118 && q.hits===1).length-
    game.bricks.filter(q=>Math.hypot(q.x-b.x,q.y-b.y)<118 && q.hits===1).length).pop();
game.damageBrick(quickBomb,quickBomb.hits);
assert(game.stageStats.chains.quickChain>=1,'stage 5 quick chain can trigger');

// One actually integrated goal-character level. Character sprite and ball
// collision must follow the same low/high pose while the board leaves room.
loadScene('PARK_GOAL1');
const goalStage=game.levelsConfig.levels[game.currentLevel];
assert.equal(goalStage.bricks.length,8,'goal board uses eight rows');
assert.equal(game.bricks.filter(b=>!b.indestructible).length,68);
assert(game.bricks.every(b=>b.y+b.height<=412),'goal board must leave a character zone');
const goal=game.targets.find(t=>t.kind==='soccer');
assert(goal?.goalArtwork && goal.character==='choseon');
for(const pose of ['low','high']) {
    assert(fs.existsSync(path.join(root,`assets/characters/animations/choseon/goal/${pose}.png`)));
}
game.elapsed=0;
game.updateStageTargets();
assert.equal(goal.poseFrame,0);
const lowPoint={x:goal.x,y:goal.y};
assert(goal.goalArtwork.top>412 && goal.goalArtwork.top+goal.goalArtwork.height<=718,'goal sprite fits the reserved area');
game.elapsed=.27;
game.updateStageTargets();
assert.equal(goal.poseFrame,1);
assert(goal.y<lowPoint.y-20,'target hitbox must move with raised pose');
assert(Math.abs(goal.x-lowPoint.x)<20,'target sideways movement must be controlled');
goal.lastHit=-100;
game.checkStageTargetCollisions({x:goal.x,y:goal.y-3,dy:-5,dx:1,radius:11,speed:4,baseSpeed:4},goal.y+3);
assert.equal(goal.count,1,'the moving illustrated goal registers a real upward score');
assert(!game.stageIsComplete(),'a score alone must not skip the block objective');
game.bricks=game.bricks.filter(b=>b.indestructible).concat(game.bricks.filter(b=>!b.indestructible).slice(0,13));
game.updateStageTargets();
assert(game.stageIsComplete(),'goal + 80% destruction should clear the round');

console.log('GAIA 40 stages: 20 trimmed images, sizes, goals, materials, movers, chains, animated goal hitbox OK');
