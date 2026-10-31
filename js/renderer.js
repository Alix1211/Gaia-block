// GAIA City: picture-led renderer for the Arkanoid physics engine.
class Renderer {
    constructor(engine) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this.width = engine.width;
        this.height = engine.height;
        this.time = 0;
        const root='assets/characters/cutouts/01_spanking/';
        this.characters={};
        for(const who of ['brown','choseon']) for(let i=1;i<=4;i++) {
            const key=`${who}:${i}`;
            const basename=`S0${i}_${who==='brown'?'brown_red':'choseon_pink'}_${i===4?'bend':'back'}.png`;
            const img=new Image();img.src=(window.GaiaAssetUrl||((v)=>v))(root+basename);
            this.characters[key]=img;
        }
        this.goalCharacters={};
        for(const who of ['brown','choseon']) for(const [i,pose] of ['low','high'].entries()) {
            const img=new Image();
            img.src=(window.GaiaAssetUrl||((v)=>v))(`assets/characters/animations/${who}/goal/${pose}.png`);
            this.goalCharacters[`${who}:${i}`]=img;
        }
    }

    render() {
        this.time += 1 / 60;
        const ctx = this.ctx;
        const e = this.engine;
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.save();
        if (e.screenShake > .6) ctx.translate((Math.random()-.5)*e.screenShake, (Math.random()-.5)*e.screenShake);
        this.background();
        if (e.shieldActive) this.shield();
        for (const target of e.targets||[]) this.target(target);
        for (const brick of e.bricks) this.brick(brick);
        for (const power of e.powerUps) this.power(power);
        for (const laser of e.lasers) this.laser(laser);
        for (const missile of e.missiles) this.missile(missile);
        if (e.paddle) this.paddle();
        for (const ball of e.balls) this.ball(ball);
        for (const particle of e.particles) this.particle(particle);
        ctx.restore();
        if (e.flashAlpha > .01) {
            ctx.fillStyle = `rgba(255,245,251,${Math.min(.65,e.flashAlpha)})`;
            ctx.fillRect(0, 0, this.width, this.height);
        }
    }

    background() {
        const ctx = this.ctx;
        // The scene behind the canvas is ONE continuous picture. Glass only
        // tints it; drawing the backdrop a second time made an obvious seam.
        const overlay = ctx.createLinearGradient(0, 0, 0, this.height);
        overlay.addColorStop(0,'rgba(168,108,214,.20)');
        overlay.addColorStop(.52,'rgba(127,82,180,.32)');
        overlay.addColorStop(1,'rgba(130,79,170,.24)');
        ctx.fillStyle = overlay; ctx.fillRect(0,0,this.width,this.height);
        ctx.strokeStyle = 'rgba(255,251,255,.75)'; ctx.lineWidth = 2;
        ctx.strokeRect(1,1,this.width-2,this.height-2);
    }

    roundRect(x,y,w,h,r) {
        const c=this.ctx; r=Math.min(r,w/2,h/2);
        c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r);
        c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r);
        c.arcTo(x,y,x+w,y,r); c.closePath();
    }

    brick(b) {
        if(this.engine.levelsConfig.levels[this.engine.currentLevel]?.stageId) {
            this.gaiaBrick(b);
            return;
        }
        const c=this.ctx;
        const colors=['#ff76c0','#ffadac','#ad8cfc'];
        const materialColors={jelly:'#ab93ff',wood:'#d9a77e',metal:'#b6bdcd',neon:'#f77af8'};
        const tint=materialColors[b.material]||colors[b.jewelShade ?? (b.type%3)] || colors[0];
        const damage=b.maxHits>1 && b.hits<b.maxHits;
        const index=damage ? (b.width>110?10:8) : (b.spriteIndex ?? 1);
        const atlas=window.GaiaArt?.bricks;
        if (b.indestructible) {
            if (atlas?.draw(c,12,b.x,b.y,b.width,b.height)) return;
            c.fillStyle='#a8a3b8';this.roundRect(b.x,b.y,b.width,b.height,5);c.fill();
            return;
        }
        const mark=b.heartMark?'heart':b.explosive?'spark':'';
        c.save();
        if(b.material==='neon' && damage) c.filter='grayscale(1)';
        const painted=atlas?.drawGlass?.(c,index,b.x,b.y,b.width,b.height,tint,mark);
        c.restore();
        if(painted) {
            if(b.mark && b.mark!=='bomb' && b.mark!=='recolor') {
                c.save();c.textAlign='center';c.textBaseline='middle';
                c.font='bold 22px sans-serif';c.lineWidth=2;
                c.strokeStyle='#fff';c.fillStyle=b.mark==='poison'?'#a5fe8f':'#fff4aa';
                c.strokeText(b.mark==='poison'?'☁':'ϟ',b.x+b.width/2,b.y+b.height/2);
                c.fillText(b.mark==='poison'?'☁':'ϟ',b.x+b.width/2,b.y+b.height/2);
                c.restore();
            }
            return;
        }
        // First few loading frames only; the supplied glass image replaces it.
        c.fillStyle=tint;this.roundRect(b.x,b.y,b.width,b.height,5);c.fill();
    }

    gaiaBrick(b) {
        const c=this.ctx;
        const material=b.spriteMaterial||b.material;
        const variant=b.spriteVariant||'rect';
        const sprite=window.GaiaBlocks?.get(material,variant);
        const damaged=b.maxHits>0 && b.hits<b.maxHits;
        const x=b.x,y=b.y,w=b.width,h=b.height;
        c.save();
        if(b.material==='neon' && damaged) {
            // First hit cuts the neon power; second hit destroys the block.
            c.filter='grayscale(1) brightness(.72)';
        } else if(b.mark==='recolor' && damaged) {
            c.filter=`hue-rotate(${b.jewelShade*100+55}deg)`;
        }
        if(sprite) {
            if(b.material==='jelly' && damaged) {
                // The first blow deforms the jelly; its physical hitbox stays fixed.
                const wobble=Math.sin(this.time*22)*1.2;
                c.drawImage(sprite,x+1,y+wobble,w-2,h-wobble*2);
            } else c.drawImage(sprite,x,y,w,h);
        } else {
            // Only a temporary loading fallback, never the old glass-block atlas.
            const fills={solid:'#ff83af',jelly:'#f879ca',wood:'#e995a2',metal:'#df6a9b',neon:'#e948ea'};
            c.fillStyle=fills[material]||'#d88bb5';
            this.roundRect(x,y,w,h,Math.min(8,h/4));c.fill();
        }
        c.restore();

        if(damaged && b.material==='metal') {
            // Distinct progressive damage for the 3-hit metal block.
            const hitCount=b.maxHits-b.hits;
            c.save();c.strokeStyle='rgba(255,247,255,.93)';c.lineWidth=1.6;
            c.shadowColor='#96345a';c.shadowBlur=3;
            c.beginPath();c.moveTo(x+w*.26,y+3);
            c.lineTo(x+w*.46,y+h*.48);c.lineTo(x+w*.39,y+h-3);
            if(hitCount>=2) {
                c.moveTo(x+w*.73,y+2);c.lineTo(x+w*.57,y+h*.42);
                c.lineTo(x+w*.78,y+h-3);
            }
            c.stroke();c.restore();
        }
        if(damaged && b.material==='jelly') {
            c.save();c.strokeStyle='rgba(255,255,255,.65)';c.lineWidth=1.5;
            c.beginPath();c.ellipse(x+w*.5,y+h*.5,w*.31,h*.22,0,0,Math.PI*2);
            c.stroke();c.restore();
        }
        if(b.indestructible) {
            c.save();c.font='bold 12px sans-serif';c.textAlign='center';c.textBaseline='middle';
            c.strokeStyle='#9d3b72';c.fillStyle='#fff8fd';c.lineWidth=2;
            c.strokeText('∞',x+w/2,y+h/2+1);c.fillText('∞',x+w/2,y+h/2+1);
            c.restore();
        }
        const symbols={bomb:'✹',poison:'☁',lightning:'ϟ',recolor:'♥'};
        if(b.mark && symbols[b.mark]) {
            c.save();c.textAlign='center';c.textBaseline='middle';
            c.font=`bold ${Math.min(19,Math.round(w*.48))}px sans-serif`;
            c.lineWidth=2.5;c.strokeStyle='#6a285b';
            c.fillStyle=b.mark==='poison'?'#c6ffbb':b.mark==='lightning'?'#fff19c':'#fff7fe';
            c.strokeText(symbols[b.mark],x+w/2,y+h/2+1);
            c.fillText(symbols[b.mark],x+w/2,y+h/2+1);
            c.restore();
        }
    }

    target(t) {
        if(!t.visible) return;
        const c=this.ctx,e=this.engine;
        const isDone=t.count>=t.required;
        c.save();c.globalAlpha=isDone?.32:1;
        const x=t.x,y=t.y;
        const pulse=1+Math.sin(this.time*5)*.055;
        if(t.kind==='pin') {
            c.translate(x,y);if(t.fallen)c.rotate(1.25);
            c.shadowColor='#ffbde0';c.shadowBlur=14;
            c.fillStyle='#fff7f5';c.strokeStyle='#f375a8';c.lineWidth=4;
            c.beginPath();c.ellipse(0,-10,18,30,0,0,Math.PI*2);c.fill();c.stroke();
            c.beginPath();c.ellipse(0,-34,11,12,0,0,Math.PI*2);c.fill();c.stroke();
            c.fillStyle='#f37bad';c.fillRect(-15,-19,30,8);
            c.restore();return;
        }
        if(t.goalArtwork) {
            const art=t.goalArtwork;
            const sprite=this.goalCharacters[`${t.character}:${t.poseFrame||0}`];
            c.save();
            c.globalAlpha=isDone?.34:1;
            c.fillStyle='rgba(88,35,97,.19)';
            c.beginPath();c.ellipse(art.left+art.width*.5,art.top+art.height-7,
                art.width*.37,8,0,0,Math.PI*2);c.fill();
            if(sprite?.complete && sprite.naturalWidth)
                c.drawImage(sprite,art.left,art.top,art.width,art.height);
            c.restore();
            c.save();
            c.fillStyle=isDone?'rgba(147,255,211,.12)':'rgba(255,224,130,.09)';
            c.shadowColor=isDone?'#9df5d3':'#ffbad3';c.shadowBlur=13;
            c.beginPath();c.ellipse(x,y,t.width*.43,t.height*.43,0,0,Math.PI*2);c.fill();
            c.restore();
        } else if(t.kind==='soccer' || t.kind==='reflect') {
            const squat=e.levelsConfig.levels[e.currentLevel]?.features?.squat;
            const fast=e.levelsConfig.levels[e.currentLevel]?.features?.fastSquat;
            const hop=e.levelsConfig.levels[e.currentLevel]?.features?.hop;
            const cycle=[1,2,3,4,3,2];
            const frame=squat?cycle[Math.floor(e.elapsed*(fast?8:3.5))%cycle.length]:4;
            const character=this.characters[`${t.character}:${frame}`];
            const bob=hop?Math.abs(Math.sin(e.elapsed*11))*9:0;
            if(character?.complete && character.naturalWidth) {
                c.globalAlpha=isDone?.23:.78;
                c.drawImage(character,x-54,y-180-bob,108,162);
                c.globalAlpha=isDone?.32:1;
            }
        }
        if(t.kind==='basket') {
            c.strokeStyle='#ffd5ee';c.lineWidth=8;
            c.strokeRect(x-48,y-82,96,65);
            c.strokeStyle='#ff75b4';c.lineWidth=7;
            c.beginPath();c.ellipse(x,y-6,50,13,0,0,Math.PI*2);c.stroke();
        } else if(t.kind==='heart') {
            c.fillStyle='#ff60ab';c.shadowColor='#ffb5e4';c.shadowBlur=25;
            c.font=`${Math.round(118*pulse)}px sans-serif`;c.textAlign='center';c.textBaseline='middle';
            c.fillText('♥',x,y);
        } else if(t.kind==='jackpot') {
            c.fillStyle='#ffd36b';c.font='bold 78px serif';c.textAlign='center';c.textBaseline='middle';
            c.fillText('♛',x,y);
        }
        c.shadowBlur=0;c.lineWidth=t.goalArtwork?4:3;
        c.strokeStyle=isDone?'#a2ffd2':t.goalArtwork?'#ffe1a4':'#ffcced';
        c.setLineDash([6,5]);
        if(t.kind!=='basket') {c.beginPath();c.ellipse(x,y,t.width/2*pulse,t.height/2*pulse,0,0,Math.PI*2);c.stroke();}
        c.setLineDash([]);
        if(t.required>1) {
            c.font='bold 20px sans-serif';c.textAlign='center';c.fillStyle='#fff';
            c.fillText(`${t.count}/${t.required}`,x,y+t.height/2+25);
        }
        c.restore();
    }

    paddle() {
        const e=this.engine,c=this.ctx,p=e.paddle;
        let idx=12;
        if (e.laserActive) idx=15;
        else if (e.magnetActive) idx=16;
        else if (e.electricActive) idx=17;
        else if (e.shieldActive) idx=19;
        else if (p.width < p.baseWidth*.85) idx=14;
        else if (p.width > p.baseWidth*1.22) idx=13;
        const withGuns=e.laserActive || e.electricActive;
        const dw=p.width+9,dh=withGuns?75:47;
        const x=p.x-4.5,y=p.y-(withGuns?49:17);
        // The complete illustrated paddle sheet is used in every state.
        if (!window.GaiaArt?.balls.draw(c,idx,x,y,dw,dh)) {
            c.fillStyle='#ff7bc0';this.roundRect(p.x,p.y,p.width,p.height,12);c.fill();
        }
        if (e.magnetActive) {
            c.save(); c.strokeStyle='#9ffff9bb';c.lineWidth=2;
            c.beginPath();c.ellipse(p.x+p.width/2,p.y-5,p.width*.56,25,0,Math.PI,Math.PI*2);c.stroke();c.restore();
        }
    }

    ball(b) {
        const e=this.engine,c=this.ctx,r=b.radius;
        c.save();
        if (b.trail.length>2) {
            const first=b.trail[0];
            const glow=c.createLinearGradient(first.x,first.y,b.x,b.y);
            if (e.fireballActive) {
                glow.addColorStop(0,'rgba(255,145,88,0)');
                glow.addColorStop(.45,'rgba(255,116,110,.45)');
                glow.addColorStop(1,'rgba(255,247,181,.9)');
            } else {
                glow.addColorStop(0,'rgba(181,104,255,0)');
                glow.addColorStop(.45,'rgba(208,122,255,.5)');
                glow.addColorStop(1,'rgba(255,244,255,.95)');
            }
            c.strokeStyle=glow;c.lineWidth=3.4;c.lineCap='round';c.lineJoin='round';
            c.beginPath();c.moveTo(first.x,first.y);
            for (let i=1;i<b.trail.length;i++) {
                c.lineTo(b.trail[i].x,b.trail[i].y);
            }
            c.lineTo(b.x,b.y);c.stroke();
        }
        const index=e.fireballActive?1:e.electricActive?5:e.slowActive?2:e.balls.length>1?3:0;
        if (!window.GaiaArt?.balls.draw(c,index,b.x-r*1.38,b.y-r*1.38,r*2.76,r*2.76)) {
            c.fillStyle='#fff';c.beginPath();c.arc(b.x,b.y,r,0,Math.PI*2);c.fill();
        }
        c.restore();
    }

    power(p) {
        const c=this.ctx,sz=38+Math.sin(p.pulse)*2;
        const ballArt={multiball:3,laser:4,expand:7,fireball:1,shield:6,
            slow:2,magnet:8,missile:10,shrink:9,electric:5,life:7};
        const index=ballArt[p.power.effect]??7;
        if (window.GaiaArt?.balls.draw(c,index,p.x-sz/2,p.y-sz/2,sz,sz)) return;
        c.fillStyle=p.power.color;
        c.beginPath();c.arc(p.x,p.y,sz/2,0,Math.PI*2);c.fill();
    }

    laser(l) {
        const c=this.ctx;c.save();c.strokeStyle='#ffedfd';c.lineWidth=4;c.shadowBlur=16;c.shadowColor='#ff2fbc';
        c.beginPath();c.moveTo(l.x+2,l.y+l.height);c.lineTo(l.x+2,l.y);c.stroke();c.restore();
    }

    missile(m) {
        const c=this.ctx;c.save();
        for(const t of m.trail){c.fillStyle=`rgba(255,148,114,${t.alpha*.5})`;c.beginPath();c.arc(t.x,t.y,4*t.alpha,0,Math.PI*2);c.fill();}
        c.fillStyle='#ffe4af';c.shadowColor='#ff5b57';c.shadowBlur=15;
        c.beginPath();c.arc(m.x,m.y,6,0,Math.PI*2);c.fill();c.restore();
    }

    particle(p) {
        const c=this.ctx;c.save();c.globalAlpha=Math.max(0,p.life);
        c.fillStyle=p.color;
        c.beginPath();
        if (p.type==='brick' || p.type==='explosion') {
            const size=Math.max(1.3,p.size*p.life*1.8);
            c.moveTo(p.x,p.y-size);c.lineTo(p.x+size*.65,p.y+size*.7);
            c.lineTo(p.x-size*.66,p.y+size*.2);c.closePath();
        } else c.arc(p.x,p.y,Math.max(.4,p.size*p.life),0,Math.PI*2);
        c.fill();c.restore();
    }

    shield() {
        const c=this.ctx,e=this.engine;c.save();
        c.strokeStyle=`rgba(132,244,255,${.5+Math.sin(this.time*6)*.25})`;c.shadowColor='#60dfff';c.shadowBlur=15;c.lineWidth=5;
        c.beginPath();c.moveTo(0,this.height-15);
        for(let x=0;x<=this.width;x+=10)c.lineTo(x,this.height-15+Math.sin(x*.02+this.time*3)*2);
        c.stroke();c.restore();
    }
}
