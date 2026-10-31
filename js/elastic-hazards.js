// GAIA HEART BREAKER — optional oversized, breathing character hazards.
// Loaded after stages40.js and engine.js; deliberately does not modify
// goal, squat, hop or dialogue assets. Stage placement stays script-key based.
(function () {
    'use strict';
    const assignments = {
        CASINO_DOUBLE: {who:'brown',pose:'lookback'},
        CASINO_TIMING: {who:'choseon',pose:'lookback'},
        CLUB_NEON: {who:'brown',pose:'seated'},
        CLUB_CHAIN: {who:'choseon',pose:'seated'},
        POLICE_TEST: {who:'brown',pose:'split'},
        POLICE_BARRIER: {who:'choseon',pose:'split'}
    };
    const assetPaths = {
        brown: {
            lookback:'assets/characters/animations/brown/goal/look-back.png',
            seated:'assets/characters/source_sheets/12-1000109497.png',
            split:'assets/characters/source_sheets/14-1000109492.png'
        },
        choseon: {
            lookback:'assets/characters/animations/choseon/goal/look-back.png',
            seated:'assets/characters/source_sheets/13-1000109494.png',
            split:'assets/characters/source_sheets/15-1000109491.png'
        }
    };
    // Coordinates are percentages of each ORIGINAL uncropped image, not an
    // approximate full-body rectangle. Only painted garment regions bounce.
    const zones = {
        lookback: [
            {cx:.70,cy:.57,rx:.155,ry:.10},
            {cx:.31,cy:.44,rx:.115,ry:.065}
        ],
        seated: [
            {cx:.50,cy:.365,rx:.158,ry:.073},
            {cx:.50,cy:.592,rx:.125,ry:.063}
        ],
        split: [
            {cx:.50,cy:.345,rx:.139,ry:.088},
            {cx:.50,cy:.56,rx:.110,ry:.065}
        ]
    };
    // Maximize the illustrated full body within 800x800, avoiding paddle.
    const frames = {
        lookback:{left:90,top:36,width:620,height:692},
        seated:{left:140,top:-35,width:520,height:775},
        split:{left:5,top:145,width:790,height:530}
    };
    for(const stage of window.GAIA_40_STAGES || []) {
        const selected=assignments[stage.sceneKey];
        if(!selected) continue;
        stage.features={...stage.features,elasticCharacter:{...selected}};
        // Keep the on-screen portrait, costume and reaction tied to the visible person.
        stage.character=selected.who;
    }

    const oldLoadLevel=GameEngine.prototype.loadLevel;
    GameEngine.prototype.loadLevel=function(index) {
        oldLoadLevel.call(this,index);
        const selected=this.levelsConfig?.levels[index]?.features?.elasticCharacter;
        if(!selected) {this.elasticCharacter=null;return;}
        this.elasticCharacter={
            ...selected,...frames[selected.pose],zones:zones[selected.pose],
            lastHit:-1000,triggered:-1000,impactX:0,impactY:0
        };
    };

    function findGarmentCollision(ball,actor) {
        const x=(ball.x-actor.left)/actor.width;
        const y=(ball.y-actor.top)/actor.height;
        // Ball radius is counted in each ellipse. All other parts pass through.
        for(const z of actor.zones) {
            const rx=z.rx+ball.radius/actor.width;
            const ry=z.ry+ball.radius/actor.height;
            const a=(x-z.cx)/rx, b=(y-z.cy)/ry;
            if(a*a+b*b<=1) return z;
        }
        return null;
    }

    GameEngine.prototype.checkElasticCharacter=function(ball) {
        const actor=this.elasticCharacter;
        if(!actor) return;
        const zone=findGarmentCollision(ball,actor);
        if(!zone) {
            if(ball.elasticContact===actor)ball.elasticContact=null;
            return;
        }
        if(ball.elasticContact===actor)return;
        if(this.elapsed-actor.lastHit<.12)return;

        // Ellipse normal, in screen-space coordinates. Reflect rather than
        // blindly reversing y; diagonal and edge impacts must feel different.
        const cx=actor.left+zone.cx*actor.width;
        const cy=actor.top+zone.cy*actor.height;
        const radiusX=zone.rx*actor.width;
        const radiusY=zone.ry*actor.height;
        let nx=(ball.x-cx)/(radiusX*radiusX);
        let ny=(ball.y-cy)/(radiusY*radiusY);
        let length=Math.hypot(nx,ny);
        if(length<1e-7) {
            const speed=Math.max(1,Math.hypot(ball.dx,ball.dy));
            nx=-ball.dx/speed;ny=-ball.dy/speed;
        } else {nx/=length;ny/=length;}
        const approach=ball.dx*nx+ball.dy*ny;
        if(approach>=0) return;
        const speedBefore=Math.hypot(ball.dx,ball.dy);
        ball.dx=(ball.dx-2*approach*nx)*1.20;
        ball.dy=(ball.dy-2*approach*ny)*1.20;
        const speedAfter=Math.hypot(ball.dx,ball.dy);
        if(speedBefore>0 && speedAfter<speedBefore*1.20-1e-6) {
            const correction=speedBefore*1.20/Math.max(1e-6,speedAfter);
            ball.dx*=correction;ball.dy*=correction;
        }
        ball.x+=nx*(ball.radius+3);
        ball.y+=ny*(ball.radius+3);
        ball.elasticContact=actor;
        actor.lastHit=this.elapsed;
        actor.triggered=this.elapsed;
        actor.impactX=ball.x;
        actor.impactY=ball.y;
        this.screenShake=Math.max(this.screenShake,3);
        this.spawnSparkParticles?.(ball.x,ball.y);
        window.GaiaSound?.play?.(720,'sine',.12,.06);
        window.GaiaSound?.powerUp?.();
        this.onStageEvent?.({type:'bodyHit',zone:'hip',elastic:true,actor});
    };

    // Brick collisions resolve first. Foreground bricks shield the person in
    // the same physics step, keeping the layer order honest.
    const oldCheckTargets=GameEngine.prototype.checkStageTargetCollisions;
    GameEngine.prototype.checkStageTargetCollisions=function(ball,oldY) {
        oldCheckTargets.call(this,ball,oldY);
        this.checkElasticCharacter(ball);
    };

    // A 20% speed multiplier compounds rapidly. Small steps prevent tunnelling
    // through the paddle, blocks or garment while this hazard is present.
    const oldUpdateBalls=GameEngine.prototype.updateBalls;
    GameEngine.prototype.updateBalls=function(dt) {
        if(!this.elasticCharacter || this.ballAttached)
            return oldUpdateBalls.call(this,dt);
        const fastest=this.balls.reduce((m,b)=>Math.max(m,Math.hypot(b.dx,b.dy)),0);
        const maxStep=Math.max(4,(this.balls[0]?.radius||11)*.55);
        const steps=Math.max(1,Math.min(32,Math.ceil(fastest*dt/maxStep)));
        for(let i=0;i<steps;i++) {
            if(this.state!=='playing')break;
            oldUpdateBalls.call(this,dt/steps);
        }
    };

    window.GaiaElasticArt={paths:assetPaths,assignments,frames,zones};

    // Render large character before the existing targets and foreground bricks.
    // Draw only, no debug ring; the original illustration is never modified.
    const oldBackground=Renderer.prototype.background;
    Renderer.prototype.background=function() {
        oldBackground.call(this);
        const actor=this.engine.elasticCharacter;
        if(!actor)return;
        if(!this.elasticSprites)this.elasticSprites={};
        const key=actor.who+':'+actor.pose;
        let img=this.elasticSprites[key];
        if(!img) {
            img=new Image();
            img.src=(window.GaiaAssetUrl||((v)=>v))(assetPaths[actor.who][actor.pose]);
            this.elasticSprites[key]=img;
        }
        if(!img.complete||!img.naturalWidth)return;
        const c=this.ctx,elapsed=this.engine.elapsed;
        const breathe=1+Math.sin(elapsed*2.5)*.009;
        const after=elapsed-actor.triggered;
        const impact=after>=0 && after<.18?(1-after/.18):0;
        c.save();
        // Anchor hands/feet to the lower edge, breathing is only ~1%.
        c.translate(actor.left+actor.width*.5,actor.top+actor.height);
        c.scale(1+impact*.028,breathe-impact*.055);
        c.drawImage(img,-actor.width*.5,-actor.height,actor.width,actor.height);
        c.restore();
        if(impact>0) {
            c.save();
            c.globalAlpha=impact*.72;
            c.strokeStyle='#fff4b4';
            c.lineWidth=3;
            c.beginPath();c.arc(actor.impactX,actor.impactY,12+(1-impact)*23,0,Math.PI*2);
            c.stroke();c.restore();
        }
    };
})();