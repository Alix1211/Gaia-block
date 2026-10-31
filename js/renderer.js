// GAIA City: picture-led renderer for the Arkanoid physics engine.
class Renderer {
    constructor(engine) {
        this.engine = engine;
        this.ctx = engine.ctx;
        this.width = engine.width;
        this.height = engine.height;
        this.time = 0;
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
        const c=this.ctx;
        const colors=['#ff76c0','#ffadac','#ad8cfc'];
        const tint=colors[b.jewelShade ?? (b.type%3)] || colors[0];
        const damage=b.maxHits>1 && b.hits<b.maxHits;
        const index=damage ? (b.width>110?10:8) : (b.spriteIndex ?? 1);
        const atlas=window.GaiaArt?.bricks;
        if (b.indestructible) {
            if (atlas?.draw(c,12,b.x,b.y,b.width,b.height)) return;
            c.fillStyle='#a8a3b8';this.roundRect(b.x,b.y,b.width,b.height,5);c.fill();
            return;
        }
        const mark=b.heartMark?'heart':b.explosive?'spark':'';
        if (atlas?.drawGlass?.(c,index,b.x,b.y,b.width,b.height,tint,mark)) return;
        // First few loading frames only; the supplied glass image replaces it.
        c.fillStyle=tint;this.roundRect(b.x,b.y,b.width,b.height,5);c.fill();
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
