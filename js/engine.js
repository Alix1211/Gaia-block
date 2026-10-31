// ============================================
// ARKANOID NEW ERA - Game Engine
// ============================================

class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        // Game state
        this.state = 'menu'; // menu, shipSelect, playing, paused, gameOver, levelComplete, victory
        this.score = 0;
        this.lives = 3;
        this.currentLevel = 0;
        this.combo = 0;
        this.maxCombo = 0;

        // Config data (loaded externally)
        this.levelsConfig = null;
        this.shipsConfig = null;
        this.powersConfig = null;

        // Game objects
        this.paddle = null;
        this.balls = [];
        this.bricks = [];
        this.powerUps = [];
        this.particles = [];
        this.lasers = [];
        this.missiles = [];
        this.shieldActive = false;
        this.shieldTimer = 0;
        this.magnetActive = false;
        this.magnetTimer = 0;
        this.fireballActive = false;
        this.fireballTimer = 0;
        this.laserActive = false;
        this.laserTimer = 0;
        this.laserCooldown = 0;
        this.electricActive = false;
        this.electricTimer = 0;
        this.expandTimer = 0;
        this.shrinkTimer = 0;
        this.slowActive = false;
        this.slowTimer = 0;
        this.elapsed = 0;
        this.targets = [];
        this.stageStats = null;
        this.stageEvents = [];
        this.stageCleared = false;
        this.poisonClouds = [];
        this.onBrickHit = null;
        this.onStageEvent = null;
        this.onRoundEnd = null; // Result UI must not depend on the next canvas render.

        // Selected ship
        this.selectedShip = null;
        this.shipSelectIndex = 0;

        // Input
        this.keys = {};
        this.mouseX = this.width / 2;
        this.touchX = null;
        this.usingKeyboard = false;
        this.lastMouseX = this.width / 2;

        // Visual
        this.backgroundRenderer = null;
        this.screenShake = 0;
        this.flashAlpha = 0;

        // Timing
        this.lastTime = 0;
        this.deltaTime = 0;
        this.animationFrame = null;

        // UI state
        this.menuHoverButton = null;
        this.ballAttached = true;

        this.setupInput();
    }

    async loadConfigs() {
        // v0.1 offline build: allow the game to run from a local file without fetch().
        if (window.GAIA_CONFIGS) {
            this.levelsConfig = window.GAIA_CONFIGS.levels;
            this.shipsConfig = window.GAIA_CONFIGS.ships;
            this.powersConfig = window.GAIA_CONFIGS.powers;
            return;
        }
        const [levels, ships, powers] = await Promise.all([
            fetch('config/levels.json').then(r => r.json()),
            fetch('config/ships.json').then(r => r.json()),
            fetch('config/powers.json').then(r => r.json())
        ]);
        this.levelsConfig = levels;
        this.shipsConfig = ships;
        this.powersConfig = powers;
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd') {
                this.usingKeyboard = true;
            }
            if (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
            }
            if (this.state === 'playing' && e.key === ' ') {
                if (this.ballAttached) {
                    this.launchBall();
                }
            }
            if (this.state === 'playing' && e.key === 'p') {
                this.state = 'paused';
            } else if (this.state === 'paused' && e.key === 'p') {
                this.state = 'playing';
            }
            // Escape is handled by the outer game UI so the pause overlay stays in sync.
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            this.mouseX = (e.clientX - rect.left) * scaleX;
            if (Math.abs(this.mouseX - this.lastMouseX) > 3) {
                this.usingKeyboard = false;
            }
            this.lastMouseX = this.mouseX;
            this.canvas.style.cursor = this.state === 'playing' ? 'none' : 'pointer';
        });

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const clickX = (e.clientX - rect.left) * scaleX;
            const clickY = (e.clientY - rect.top) * scaleY;

            this.handleClick(clickX, clickY);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.usingKeyboard = false;
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            this.touchX = (e.touches[0].clientX - rect.left) * scaleX;
            this.mouseX = this.touchX;
        }, { passive: false });

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.usingKeyboard = false;
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const clickX = (e.touches[0].clientX - rect.left) * scaleX;
            const clickY = (e.touches[0].clientY - rect.top) * scaleY;
            this.touchX = clickX;
            this.mouseX = clickX;

            if (this.state === 'playing' && this.ballAttached) {
                this.launchBall();
            } else {
                this.handleClick(clickX, clickY);
            }
        }, { passive: false });
    }

    handleClick(x, y) {
        if (this.state === 'menu') {
            // Play button
            if (x > this.width / 2 - 120 && x < this.width / 2 + 120 &&
                y > this.height / 2 + 40 && y < this.height / 2 + 100) {
                this.state = 'shipSelect';
            }
        } else if (this.state === 'shipSelect') {
            this.handleShipSelectClick(x, y);
        } else if (this.state === 'gameOver' || this.state === 'victory') {
            // Restart button
            if (x > this.width / 2 - 120 && x < this.width / 2 + 120 &&
                y > this.height / 2 + 80 && y < this.height / 2 + 140) {
                this.resetGame();
                this.state = 'menu';
            }
        } else if (this.state === 'levelComplete') {
            if (x > this.width / 2 - 120 && x < this.width / 2 + 120 &&
                y > this.height / 2 + 80 && y < this.height / 2 + 140) {
                this.nextLevel();
            }
        } else if (this.state === 'playing' && this.ballAttached) {
            this.launchBall();
        }
    }

    handleShipSelectClick(x, y) {
        const ships = this.shipsConfig.ships;
        const cardWidth = 200;
        const totalWidth = ships.length * cardWidth + (ships.length - 1) * 30;
        const startX = (this.width - totalWidth) / 2;

        for (let i = 0; i < ships.length; i++) {
            const cx = startX + i * (cardWidth + 30);
            if (x > cx && x < cx + cardWidth && y > 200 && y < 520) {
                this.shipSelectIndex = i;
            }
        }

        // Confirm button
        if (x > this.width / 2 - 100 && x < this.width / 2 + 100 &&
            y > 560 && y < 620) {
            this.selectedShip = ships[this.shipSelectIndex];
            this.startGame();
        }
    }

    startGame() {
        if (!this.selectedShip) this.selectedShip = this.shipsConfig.ships[0];
        this.score = 0;
        this.lives = 3;
        this.currentLevel = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.loadLevel(0);
        this.state = 'playing';
    }

    resetGame() {
        this.score = 0;
        this.lives = 3;
        this.currentLevel = 0;
        this.combo = 0;
        this.powerUps = [];
        this.particles = [];
        this.lasers = [];
        this.missiles = [];
        this.clearPowerEffects();
    }

    clearPowerEffects() {
        this.shieldActive = false;
        this.magnetActive = false;
        this.fireballActive = false;
        this.laserActive = false;
        this.electricActive = false;
        this.slowActive = false;
        this.expandTimer = 0;
        this.shrinkTimer = 0;
        this.slowTimer = 0;
        this.electricTimer = 0;
        this.shieldTimer = 0;
        this.magnetTimer = 0;
        this.fireballTimer = 0;
        this.laserTimer = 0;
        if (this.paddle) {
            this.paddle.width = this.selectedShip.width;
        }
    }

    loadLevel(index) {
        const level = this.levelsConfig.levels[index];
        if (!level) {
            this.state = 'victory';
            return;
        }

        this.currentLevel = index;
        this.bricks = [];
        this.powerUps = [];
        this.lasers = [];
        this.missiles = [];
        this.particles = [];
        this.clearPowerEffects();
        this.combo = 0;
        this.elapsed = 0;
        this.stageCleared = false;
        this.stageEvents = [];
        this.targets = [];
        this.poisonClouds = [];

        // Create paddle
        this.paddle = {
            x: this.width / 2 - this.selectedShip.width / 2,
            y: this.height - 50,
            width: this.selectedShip.width,
            height: this.selectedShip.height,
            baseWidth: this.selectedShip.width,
            speed: this.selectedShip.speed
        };

        // Authored GAIA layout, with independent material, marks and goals.
        if (level.stageId) {
            const rows = level.bricks.length, cols = 10;
            // Rectangular PNGs are ~2.3:1. Keep their collision rectangles the
            // same shape as the painted blocks instead of squashing into 73x57.
            const gap = 4, bw = 73, bh = 32, rowStep = 44;
            const left = (this.width - (cols*(bw+gap)-gap))/2;
            const materials = {
                solid:{hits:1,points:10,color1:'#ff86bd',color2:'#db4a91'},
                jelly:{hits:2,points:25,color1:'#b5a1fd',color2:'#8754ba'},
                wood:{hits:1,points:20,color1:'#e2ac81',color2:'#b77c52'},
                metal:{hits:3,points:45,color1:'#a9b0c6',color2:'#727a98'},
                neon:{hits:2,points:30,color1:'#ff67de',color2:'#983df5'}
            };
            level.bricks.forEach((row,r)=>row.forEach((cell,c)=>{
                if (!cell) return;
                const mat = materials[cell.material] || materials.solid;
                const hits = cell.mark==='recolor' ? Math.max(3,mat.hits) : mat.hits;
                // Marked blocks use real square artwork and a square hitbox.
                const special=Boolean(cell.mark);
                const width=special?34:bw;
                const spriteVariant=special?'square':(r+c+index)%3===0?'rect-alt':'rect';
                const x=left+c*(bw+gap)+(bw-width)/2;
                const y=72+r*rowStep;
                this.bricks.push({x,baseX:x,y,width,height:bh,type:1,
                    material:cell.material,mark:cell.mark,hits,maxHits:hits,
                    points:mat.points,color1:mat.color1,color2:mat.color2,
                    explosive:cell.mark==='bomb',indestructible:false,
                    jewelShade:(r*7+c*11+index)%3,spriteVariant,
                    heartMark:cell.mark==='recolor',moveAmp:0,movePhase:0,
                    shimmer:0,poisonAt:0});
            }));
            const blockers = Math.min(3,level.features.movers||0);
            for(let i=0;i<blockers;i++) {
                const y = 530 + i*36;
                // The moving indestructible obstacle is a horizontal metal bar.
                const w = 130;
                const center = (i+1)*this.width/(blockers+1);
                // A genuinely indestructible, horizontally travelling bar.
                const x = center-w/2;
                this.bricks.push({x,baseX:x,y,width:w,height:27,
                    material:'fixed',mark:null,type:5,hits:-1,maxHits:-1,
                    points:0,color1:'#a8a3b8',color2:'#73788e',
                    indestructible:true,explosive:false,moveAmp:Math.min(90,40+index*1.2),
                    movePhase:i*Math.PI,moveSpeed:1.1+(index%5)*.16,
                    variableMove:!!level.features.variableMove,spriteVariant:'long',spriteMaterial:'metal'});
            }
            this.stageStats = {total:this.bricks.filter(b=>!b.indestructible).length,
                goals:{},chains:{bombChain:0,poisonChain:0,lightningChain:0,quickChain:0},
                recentKills:[]};
            this.setupStageTargets(level);
        } else {
        // Original 8-board generator retained for archival/non-GAIA configs.
        this.stageStats = null;
        // Create bricks
        const grid = level.bricks.map(row => [...row]);
        // Preserve the stage pattern and special blocks, but replace the
        // original sparse checkerboard with the packed jewel field in the art.
        const cols = grid[0].length;
        while (grid.length < 7) {
            const rowNo = grid.length;
            grid.push(Array.from({length:cols},(_,column) =>
                (column + rowNo + index) % 9 === 0 ? 0 : (column + rowNo) % 5 === 0 ? 2 : 1));
        }
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < cols; c++) {
                if (!grid[r][c] && (r <= 2 || (r*7 + c*3 + index) % 6 !== 0)) {
                    grid[r][c] = 1 + (r + c*2 + index) % 3;
                }
            }
        }
        if (index === 0) {
            grid[1][2] = 5;
            grid[1][7] = 5;
            grid[4][5] = 5;
        }
        const brickWidth = 73;
        const brickHeight = Math.min(57,Math.floor(460 / grid.length) - 4);
        const brickPadding = 4;
        const offsetTop = 68;
        const totalBrickWidth = cols * (brickWidth + brickPadding) - brickPadding;
        const offsetLeft = (this.width - totalBrickWidth) / 2;

        for (let r = 0; r < grid.length; r++) {
            const row = grid[r];
            for (let c = 0; c < row.length;) {
                const type = row[c];
                if (type === 0) { c++; continue; }
                const brickType = this.levelsConfig.brickTypes[type.toString()];
                // Merge adjacent equal cells into genuinely long bricks on selected rows.
                let span = 1;
                if (type !== 5 && (r + index) % 3 === 1 && c % 3 === 0) {
                    while (span < (index >= 4 ? 3 : 2) && c + span < row.length && row[c + span] === type) span++;
                }
                const isSquare = span === 1;
                const w = span * (brickWidth + brickPadding) - brickPadding;
                const x = offsetLeft + c * (brickWidth + brickPadding);
                const moving = index >= 3 && r % 4 === index % 3 && type !== 5;
                this.bricks.push({
                    x, baseX:x, y:offsetTop + r * (brickHeight + brickPadding),
                    width:w, height:brickHeight, type, hits:brickType.hits,
                    maxHits:brickType.hits, points:brickType.points,
                    color1:brickType.color1, color2:brickType.color2,
                    explosive:brickType.explosive || false,
                    indestructible:brickType.indestructible || false,
                    jewelShade:(r*7+c*11+index)%3,
                    spriteIndex:isSquare ? 1 : span > 2 ? 3 : 2,
                    heartMark:!brickType.indestructible && !brickType.explosive && (r*3+c*5+index)%13===2,
                    moveAmp:moving ? 7 + (r % 3) * 4 : 0,
                    movePhase:r * 1.2 + c * .21,
                    shimmer:Math.random()*Math.PI*2
                });
                c += span;
            }
        }
        }

        // Create ball
        this.balls = [{
            x: this.paddle.x + this.paddle.width / 2,
            y: this.paddle.y - 12,
            radius: 11,
            dx: level.ballSpeed * (Math.random() > 0.5 ? 1 : -1) * 0.7,
            dy: -level.ballSpeed,
            speed: level.ballSpeed,
            baseSpeed: level.ballSpeed,
            trail: []
        }];
        this.ballAttached = true;

        // The GAIA renderer uses the supplied illustrated stage backdrops.
        this.backgroundRenderer = null;
    }

    setupStageTargets(level) {
        // Source coordinates in the normalized 832x928 transparent goal frames.
        // The target follows the illustrated hip/waist area in both poses;
        // this avoids showing a moving character over a static scoring ring.
        const goalHotspots={
            brown:[{x:330,y:650},{x:270,y:600}],
            choseon:[{x:475,y:650},{x:500,y:525}]
        };
        for (const [kind, counts] of Object.entries(level.objectives || {})) {
            if (!Array.isArray(counts)) continue;
            const number = counts.length;
            counts.forEach((required,i) => {
                const spacing = number===1 ? 0 : number===2 ? 240 : number===3 ? 200 : 140;
                const baseX = 400+(i-(number-1)/2)*spacing;
                const targetY = kind==='basket'?590:
                    (kind==='heart'||kind==='soccer'||kind==='jackpot')?660:620;
                const target={kind,id:`${kind}:${i}`,index:i,count:0,required,
                    x:baseX,baseX,y:targetY,width:kind==='heart'?120:kind==='pin'?64:108,
                    height:kind==='heart'?85:kind==='pin'?78:68,
                    lastHit:-100,fallen:false,visible:false,triggered:0,
                    moveAmp:kind==='soccer'?(level.features.goalMove||0):
                        kind==='basket'?(level.features.basketMove||0):0,
                    character:i%2?(level.character==='brown'?'choseon':'brown'):level.character};
                if(kind==='soccer' && level.features.goalCharacter) {
                    const hotspots=goalHotspots[target.character];
                    const width=268,scale=width/832,height=928*scale;
                    target.goalArtwork={
                        left:baseX-hotspots[0].x*scale,
                        top:716-height,width,height,scale,hotspots
                    };
                    target.poseFrame=0;
                    target.width=96;
                    target.height=58;
                    target.y=target.goalArtwork.top+hotspots[0].y*scale;
                }
                this.targets.push(target);
            });
        }
    }

    blockProgress() {
        if (!this.stageStats) return this.bricks.some(b=>!b.indestructible)?0:1;
        const remaining = this.bricks.filter(b=>!b.indestructible).length;
        return Math.max(0,1-remaining/Math.max(1,this.stageStats.total));
    }

    stageGoalText() {
        const stage=this.levelsConfig.levels[this.currentLevel];
        if (!stage?.stageId) return '';
        const items=[`◆ ${Math.floor(this.blockProgress()*100)} / ${Math.round(stage.clear*100)}%`];
        const icons={soccer:'⚽',basket:'◎',reflect:'♥',pin:'♟',jackpot:'♛',heart:'♥'};
        const tally=new Map();
        for (const t of this.targets) {
            const value=tally.get(t.kind)||{got:0,need:0};
            value.got+=t.count;value.need+=t.required;tally.set(t.kind,value);
        }
        for(const [kind,value] of tally)
            items.push(`${icons[kind]||'★'} ${value.got}/${value.need}`);
        const marks={bombChain:'✹',poisonChain:'☁',lightningChain:'ϟ',quickChain:'✦'};
        for(const [key,required] of Object.entries(stage.objectives||{})) {
            if (Array.isArray(required)) continue;
            items.push(`${marks[key]||'★'} ${Math.min(required,this.stageStats?.chains[key]||0)}/${required}`);
        }
        return items.join('  ·  ');
    }

    updateStageTargets() {
        const stage=this.levelsConfig.levels[this.currentLevel];
        if (!stage?.stageId) return;
        const progress=this.blockProgress();
        for(const target of this.targets) {
            const previouslyVisible=target.visible;
            const reveal=target.kind==='reflect'?(stage.features.reveal??.3):
                target.kind==='heart'?(stage.clear):0;
            target.visible=progress+1e-8>=reveal;
            if(target.visible && !previouslyVisible && reveal>0)
                this.onStageEvent?.({type:'reveal',target});
            if(target.goalArtwork) {
                target.poseFrame=Math.floor(this.elapsed/.24)%2;
                const art=target.goalArtwork;
                const focus=art.hotspots[target.poseFrame];
                target.x=art.left+focus.x*art.scale;
                target.y=art.top+focus.y*art.scale;
            } else {
                target.x=target.baseX+Math.sin(this.elapsed*1.5+target.index*2.1)*target.moveAmp;
            }
        }
    }

    checkStageTargetCollisions(ball,oldY) {
        if (!this.stageStats) return;
        for(const target of this.targets) {
            if (!target.visible || target.count>=target.required) continue;
            if(this.elapsed-target.lastHit<.8) continue;
            const dx=Math.abs(ball.x-target.x);
            if(dx>target.width/2+ball.radius*.5) continue;
            let hit=false;
            if(target.kind==='soccer') hit=ball.dy<0 && oldY>target.y && ball.y<=target.y;
            else if(target.kind==='basket') hit=ball.dy>0 && oldY<target.y && ball.y>=target.y;
            else hit=Math.abs(ball.y-target.y)<target.height/2+ball.radius &&
                Math.abs(oldY-target.y)>=Math.abs(ball.y-target.y);
            if (!hit) continue;
            target.lastHit=this.elapsed;target.count++;target.triggered=this.elapsed;
            if(this.levelsConfig.levels[this.currentLevel]?.features?.alternate && target.kind==='soccer')
                target.character=target.character==='brown'?'choseon':'brown';
            this.onStageEvent?.({type:target.kind,target});
            target.fallen=target.kind==='pin';
            this.score+=150;
            this.screenShake=Math.max(3,this.screenShake);
            this.spawnSparkParticles(target.x,target.y);
            // Bounce the ball safely out of the hitbox; never count one pass twice.
            const upwards=ball.dy<0;
            ball.dy=upwards?Math.abs(ball.dy):-Math.abs(ball.dy);
            ball.y=target.y+(upwards?1:-1)*(target.height/2+ball.radius+2);
            if(target.kind==='reflect') {
                const speed=Math.hypot(ball.dx,ball.dy);
                const cap=(ball.baseSpeed||ball.speed)*1.5;
                const factor=Math.min(cap/speed,1.12);
                if(factor>1) {ball.dx*=factor;ball.dy*=factor;}
            }
            window.GaiaSound?.powerUp();
            break;
        }
    }

    stageIsComplete() {
        if (!this.stageStats) return !this.bricks.some(b=>!b.indestructible);
        const stage=this.levelsConfig.levels[this.currentLevel];
        if(this.blockProgress()+1e-8<stage.clear) return false;
        if(this.targets.some(t=>t.count<t.required)) return false;
        for(const [key,required] of Object.entries(stage.objectives||{})) {
            if(!Array.isArray(required) && (this.stageStats.chains[key]||0)<required) return false;
        }
        return true;
    }

    noteBrickDestroyed(brick,source) {
        if(!this.stageStats) return;
        const list=this.stageStats.recentKills;
        list.push(this.elapsed);
        while(list.length && this.elapsed-list[0]>1.2) list.shift();
        if(list.length>=5) this.stageStats.chains.quickChain=1;
        if(list.length===5) this.onStageEvent?.({type:'quickChain'});
        if(source==='poison') this.stageStats.chains.poisonChain=1;
    }

    damageBrick(brick,amount=1,source='ball',ball=null,depth=0) {
        if(brick.indestructible || !this.bricks.includes(brick)) return false;
        const wasUntouched=brick.hits===brick.maxHits;
        brick.hits-=amount;
        if(brick.mark==='recolor') brick.jewelShade=(brick.jewelShade+1)%3;
        if(brick.material==='jelly' && wasUntouched && ball) {
            this.onStageEvent?.({type:'jelly',brick});
            const speed=Math.hypot(ball.dx,ball.dy)||1;
            const factor=Math.min(1.08,(ball.baseSpeed||ball.speed)*1.4/speed);
            if(factor>1){ball.dx*=factor;ball.dy*=factor;}
        }
        if(brick.material==='neon' && wasUntouched) this.onStageEvent?.({type:'neon',brick});
        if(brick.material==='metal' && wasUntouched) this.onStageEvent?.({type:'metal',brick});
        this.combo++;
        this.maxCombo=Math.max(this.maxCombo,this.combo);
        this.spawnBrickParticles(brick);
        const destroyed=brick.hits<=0;
        this.onBrickHit?.(brick,destroyed);
        if(!destroyed) {
            if(brick.mark==='lightning' && !brick.arcUsed && depth<3) {
                brick.arcUsed=true;
                this.electrifyNeighbors(brick,'lightning',depth+1);
            }
            return false;
        }
        this.bricks.splice(this.bricks.indexOf(brick),1);
        const comboMultiplier=1+Math.floor(this.combo/5)*.5;
        this.score+=Math.floor(brick.points*comboMultiplier);
        this.noteBrickDestroyed(brick,source);
        if(brick.material==='solid') this.onStageEvent?.({type:'solid',brick});
        this.maybeDropPowerUp(brick);
        if(brick.material==='wood') for(let i=0;i<3;i++) this.spawnBrickParticles(brick);
        if(brick.mark==='bomb' && depth<3) this.explodeBrick(brick,-1,depth+1);
        if(brick.mark==='poison') this.poisonClouds.push({x:brick.x+brick.width/2,
            y:brick.y+brick.height/2,delay:.35,ticks:2});
        if(brick.mark==='lightning' && !brick.arcUsed && depth<3)
            this.electrifyNeighbors(brick,'lightning',depth+1);
        this.screenShake=Math.max(this.screenShake,3);
        return true;
    }

    launchBall() {
        if (!this.ballAttached || this.balls.length === 0) return;
        this.ballAttached = false;
        const ball = this.balls[0];
        const level = this.levelsConfig.levels[this.currentLevel];
        ball.dx = level.ballSpeed * 0.7;
        ball.dy = -level.ballSpeed;
    }

    nextLevel() {
        this.loadLevel(this.currentLevel + 1);
        this.state = 'playing';
    }

    update(deltaTime) {
        if (this.state !== 'playing') return;

        const dt = Math.min(deltaTime / 16.67, 2); // Normalize to ~60fps
        this.elapsed += deltaTime / 1000;
        for (const b of this.bricks) {
            if (b.moveAmp) {
                const speed=b.moveSpeed||1.1;
                const time=b.variableMove?this.elapsed*(.7+.4*Math.sin(this.elapsed*.5)):this.elapsed;
                b.x=Math.max(4,Math.min(this.width-b.width-4,b.baseX+Math.sin(time*speed+b.movePhase)*b.moveAmp));
            }
        }
        this.updateStageTargets();

        // Update paddle position
        this.updatePaddle(dt);

        // Update balls
        this.updateBalls(dt);

        // Update power-ups
        this.updatePowerUps(dt);

        // Update lasers
        this.updateLasers(dt);

        // Update missiles
        this.updateMissiles(dt);

        // Update particles
        this.updateParticles(dt);

        // Update power timers
        this.updatePowerTimers(deltaTime);
        this.updatePoisonClouds(deltaTime/1000);

        // Update screen effects
        if (this.screenShake > 0) this.screenShake *= 0.9;
        if (this.flashAlpha > 0) this.flashAlpha -= 0.05;

        // Check level complete
        if (!this.stageCleared && this.stageIsComplete()) {
            this.stageCleared=true;
            if (this.currentLevel >= this.levelsConfig.levels.length - 1) {
                this.state = 'victory';
            } else {
                this.state = 'levelComplete';
            }
            this.onRoundEnd?.(this.state);
        }

        // Fire laser
        if (this.laserActive && this.laserCooldown <= 0) {
            this.fireLaser();
            this.laserCooldown = 15;
        }
        if (this.laserCooldown > 0) this.laserCooldown -= dt;
    }

    updatePaddle(dt) {
        if (this.usingKeyboard) {
            // Keyboard control - direct speed-based movement
            if (this.keys['ArrowLeft'] || this.keys['a']) {
                this.paddle.x -= this.paddle.speed * dt;
            }
            if (this.keys['ArrowRight'] || this.keys['d']) {
                this.paddle.x += this.paddle.speed * dt;
            }
        } else {
            // Mouse/touch control - smooth interpolation
            const targetX = this.mouseX - this.paddle.width / 2;
            const diff = targetX - this.paddle.x;
            this.paddle.x += diff * 0.2 * dt;
        }

        // Clamp
        this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.width, this.paddle.x));

        // Move attached ball
        if (this.ballAttached && this.balls.length > 0) {
            this.balls[0].x = this.paddle.x + this.paddle.width / 2;
            this.balls[0].y = this.paddle.y - 12;
        }
    }

    updateBalls(dt) {
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];
            if (this.ballAttached && i === 0) continue;

            // Trail
            ball.trail.push({ x: ball.x, y: ball.y, alpha: 1 });
            if (ball.trail.length > 20) ball.trail.shift();
            ball.trail.forEach(t => t.alpha *= 0.91);

            const oldY=ball.y;
            ball.x += ball.dx * dt;
            ball.y += ball.dy * dt;

            // Wall collisions
            if (ball.x - ball.radius < 0) {
                ball.x = ball.radius;
                ball.dx = Math.abs(ball.dx);
                this.spawnWallParticles(ball.x, ball.y);
            }
            if (ball.x + ball.radius > this.width) {
                ball.x = this.width - ball.radius;
                ball.dx = -Math.abs(ball.dx);
                this.spawnWallParticles(ball.x, ball.y);
            }
            if (ball.y - ball.radius < 0) {
                ball.y = ball.radius;
                ball.dy = Math.abs(ball.dy);
                this.spawnWallParticles(ball.x, ball.y);
            }

            // Shield collision
            if (this.shieldActive && ball.y + ball.radius > this.height - 15) {
                ball.y = this.height - 15 - ball.radius;
                ball.dy = -Math.abs(ball.dy);
                this.spawnShieldParticles(ball.x);
            }

            // Bottom - lose ball
            if (ball.y - ball.radius > this.height) {
                this.balls.splice(i, 1);
                if (this.balls.length === 0) {
                    this.loseLife();
                }
                continue;
            }

            // Paddle collision
            this.checkPaddleCollision(ball);

            // Brick collision
            this.checkBrickCollisions(ball);
            // Stage goals are independent of destructible bricks.
            this.checkStageTargetCollisions(ball,oldY);
        }
    }

    checkPaddleCollision(ball) {
        const p = this.paddle;
        if (ball.dy > 0 &&
            ball.y + ball.radius > p.y &&
            ball.y + ball.radius < p.y + p.height + 5 &&
            ball.x > p.x - ball.radius &&
            ball.x < p.x + p.width + ball.radius) {

            // Calculate bounce angle based on hit position
            const hitPos = (ball.x - p.x) / p.width; // 0 to 1
            const angle = (hitPos - 0.5) * Math.PI * 0.7; // -63 to 63 degrees

            const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
            ball.dx = speed * Math.sin(angle);
            ball.dy = -speed * Math.cos(angle);
            ball.y = p.y - ball.radius;

            if (this.magnetActive) {
                // Catch the ball
                this.ballAttached = true;
                this.balls = [ball];
                ball.trail = [];
                return;
            }

            this.combo = 0;
            this.spawnPaddleParticles(ball.x);
            window.GaiaSound?.paddle();
        }
    }

    checkBrickCollisions(ball) {
        for (let i = this.bricks.length - 1; i >= 0; i--) {
            const brick = this.bricks[i];
            if (this.ballBrickCollision(ball, brick)) {
                window.GaiaSound?.brick(brick.hits);
                if (!this.fireballActive || brick.indestructible) {
                    // Normal bounce
                    this.bounceBallOffBrick(ball, brick);
                }

                if (!brick.indestructible) {
                    if (this.stageStats) {
                        this.damageBrick(brick,1,'ball',ball);
                        if (this.electricActive) this.electrifyNeighbors(brick,'electric',1);
                        if (!this.fireballActive) break;
                        continue;
                    }
                    brick.hits--;
                    this.combo++;
                    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

                    const comboMultiplier = 1 + Math.floor(this.combo / 5) * 0.5;
                    this.score += Math.floor(brick.points * comboMultiplier);

                    this.spawnBrickParticles(brick);
                    this.onBrickHit?.(brick, brick.hits <= 0);

                    if (brick.hits <= 0) {
                        this.bricks.splice(i, 1);
                        if (brick.explosive) this.explodeBrick(brick, -1);
                        this.maybeDropPowerUp(brick);
                        this.screenShake = 3;
                    }
                    if (this.electricActive) this.electrifyNeighbors(brick);
                } else {
                    // Spark effect on indestructible
                    this.spawnSparkParticles(ball.x, ball.y);
                    this.onStageEvent?.({type:'metalBarrier',brick});
                }

                if (!this.fireballActive) break;
            }
        }
    }

    ballBrickCollision(ball, brick) {
        const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
        const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
        const distX = ball.x - closestX;
        const distY = ball.y - closestY;
        return (distX * distX + distY * distY) < (ball.radius * ball.radius);
    }

    bounceBallOffBrick(ball, brick) {
        const overlapLeft = (ball.x + ball.radius) - brick.x;
        const overlapRight = (brick.x + brick.width) - (ball.x - ball.radius);
        const overlapTop = (ball.y + ball.radius) - brick.y;
        const overlapBottom = (brick.y + brick.height) - (ball.y - ball.radius);

        const minOverlapX = Math.min(overlapLeft, overlapRight);
        const minOverlapY = Math.min(overlapTop, overlapBottom);

        if (minOverlapX < minOverlapY) {
            // Resolve penetration so the same impact is not counted twice.
            if (ball.x < brick.x + brick.width / 2) ball.x = brick.x - ball.radius - 0.4;
            else ball.x = brick.x + brick.width + ball.radius + 0.4;
            ball.dx = -ball.dx;
        } else {
            if (ball.y < brick.y + brick.height / 2) ball.y = brick.y - ball.radius - 0.4;
            else ball.y = brick.y + brick.height + ball.radius + 0.4;
            ball.dy = -ball.dy;
        }
    }

    explodeBrick(brick, index, depth=0) {
        this.screenShake = 8;
        this.flashAlpha = 0.3;
        if(this.stageStats) this.onStageEvent?.({type:'bomb',brick});

        // Damage nearby bricks
        const explosionRadius = this.stageStats?118:80;
        for (let i = this.bricks.length - 1; i >= 0; i--) {
            if (i === index) continue;
            const b = this.bricks[i];
            const dx = (b.x + b.width / 2) - (brick.x + brick.width / 2);
            const dy = (b.y + b.height / 2) - (brick.y + brick.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < explosionRadius && !b.indestructible) {
                if (this.stageStats) {
                    if (b.mark==='bomb' && b.hits<=1) this.stageStats.chains.bombChain=1;
                    this.damageBrick(b,1,'bomb',null,depth);
                    continue;
                }
                b.hits--;
                this.spawnBrickParticles(b);
                if (b.hits <= 0) {
                    this.score += b.points;
                    this.maybeDropPowerUp(b);
                    this.bricks.splice(i, 1);
                }
            }
        }

        // Explosion particles
        for (let j = 0; j < 30; j++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 6;
            this.particles.push({
                x: brick.x + brick.width / 2,
                y: brick.y + brick.height / 2,
                dx: Math.cos(angle) * speed,
                dy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.015 + Math.random() * 0.02,
                color: '#ff4444',
                size: 3 + Math.random() * 5,
                type: 'explosion'
            });
        }
    }

    electrifyNeighbors(origin,source='electric',depth=0) {
        // Electrical ball arcs to the nearest two fragile neighbors.
        const near = this.bricks.filter(b => !b.indestructible && b !== origin)
            .map(b => ({b, d:Math.hypot((b.x-origin.x), (b.y-origin.y))}))
            .filter(o => o.d < 105).sort((a,b) => a.d-b.d).slice(0,2);
        for (const {b} of near) {
            if(this.stageStats) {
                this.damageBrick(b,1,source,null,depth);
                if(source==='lightning') this.stageStats.chains.lightningChain=1;
                if(source==='lightning') this.onStageEvent?.({type:'lightning',brick:b});
                continue;
            }
            b.hits--;
            this.spawnSparkParticles(b.x+b.width/2,b.y+b.height/2);
            if (b.hits<=0) {
                const index=this.bricks.indexOf(b);
                if (index >= 0) this.bricks.splice(index,1);
                this.score+=b.points;
                this.maybeDropPowerUp(b);
            }
        }
    }

    updatePoisonClouds(dt) {
        if (!this.stageStats || !this.poisonClouds.length) return;
        for(let i=this.poisonClouds.length-1;i>=0;i--) {
            const cloud=this.poisonClouds[i];cloud.delay-=dt;
            if(cloud.delay>0) continue;
            cloud.delay+=.42;cloud.ticks--;
            const neighbors=this.bricks.filter(b=>!b.indestructible &&
                Math.hypot(b.x+b.width/2-cloud.x,b.y+b.height/2-cloud.y)<125)
                .slice(0,3);
            for(const b of neighbors) this.damageBrick(b,1,'poison',null,3);
            if(neighbors.length) this.onStageEvent?.({type:'poison'});
            if(cloud.ticks<=0) this.poisonClouds.splice(i,1);
        }
    }

    maybeDropPowerUp(brick) {
        const powers = this.powersConfig.powers;
        if (Math.random() > .28) return;
        const weight = powers.reduce((sum,p) => sum + p.dropChance,0);
        let roll = Math.random() * weight;
        const power = powers.find(p => (roll -= p.dropChance) <= 0) || powers[powers.length-1];
        this.powerUps.push({
            x: brick.x + brick.width / 2,
            y: brick.y + brick.height / 2,
            width: 30, height: 30, dy: 2,
            power, rotation: 0, pulse: 0
        });
    }

    updatePowerUps(dt) {
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const pu = this.powerUps[i];
            pu.y += pu.dy * dt;
            pu.rotation += 0.03 * dt;
            pu.pulse += 0.08 * dt;

            // Collect
            if (pu.y + pu.height > this.paddle.y &&
                pu.y < this.paddle.y + this.paddle.height &&
                pu.x + pu.width / 2 > this.paddle.x &&
                pu.x - pu.width / 2 < this.paddle.x + this.paddle.width) {
                this.activatePower(pu.power);
                this.powerUps.splice(i, 1);
                continue;
            }

            // Off screen
            if (pu.y > this.height) {
                this.powerUps.splice(i, 1);
            }
        }
    }

    activatePower(power) {
        window.GaiaSound?.powerUp();
        const ship = this.selectedShip;
        const durationMultiplier = ship.id === 'phantom' ? 1.5 : 1;

        switch (power.effect) {
            case 'multiball':
                this.activateMultiball();
                break;
            case 'laser':
                this.laserActive = true;
                this.laserTimer = power.duration * durationMultiplier;
                break;
            case 'expand':
                this.shrinkTimer = 0;
                this.paddle.width = this.paddle.baseWidth * 1.8;
                this.expandTimer = power.duration * durationMultiplier;
                break;
            case 'shrink':
                this.expandTimer = 0;
                this.paddle.width = this.paddle.baseWidth * 0.63;
                this.shrinkTimer = power.duration * durationMultiplier;
                break;
            case 'fireball':
                this.fireballActive = true;
                this.fireballTimer = power.duration * durationMultiplier;
                break;
            case 'shield':
                this.shieldActive = true;
                this.shieldTimer = power.duration * (ship.id === 'titan' ? 1.5 : 1) * durationMultiplier;
                break;
            case 'slow':
                if (!this.slowActive) this.balls.forEach(b => {
                    b.dx *= .68; b.dy *= .68; b.speed *= .68;
                });
                this.slowActive = true;
                this.slowTimer = power.duration * durationMultiplier;
                break;
            case 'magnet':
                this.magnetActive = true;
                this.magnetTimer = power.duration * durationMultiplier;
                break;
            case 'missile':
                this.fireMissiles();
                break;
            case 'electric':
                this.electricActive = true;
                this.electricTimer = power.duration * durationMultiplier;
                break;
            case 'life':
                this.lives = Math.min(5,this.lives + 1);
                break;
        }

        // Power-up collect particles
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            this.particles.push({
                x: this.paddle.x + this.paddle.width / 2,
                y: this.paddle.y,
                dx: Math.cos(angle) * (2 + Math.random() * 3),
                dy: Math.sin(angle) * (2 + Math.random() * 3),
                life: 1,
                decay: 0.03,
                color: power.color,
                size: 3 + Math.random() * 4,
                type: 'powerup'
            });
        }
    }

    activateMultiball() {
        if (this.balls.length === 0) return;
        const original = this.balls[0];
        for (let i = 0; i < 2; i++) {
            const angle = (i === 0 ? -0.4 : 0.4) + Math.random() * 0.2;
            const speed = Math.sqrt(original.dx * original.dx + original.dy * original.dy);
            this.balls.push({
                x: original.x,
                y: original.y,
                radius: original.radius,
                dx: speed * Math.sin(angle),
                dy: -speed * Math.cos(angle),
                speed: original.speed,
                trail: []
            });
        }
    }

    fireLaser() {
        this.lasers.push(
            { x: this.paddle.x + 5, y: this.paddle.y, width: 4, height: 15, dy: -10 },
            { x: this.paddle.x + this.paddle.width - 9, y: this.paddle.y, width: 4, height: 15, dy: -10 }
        );
    }

    fireMissiles() {
        const targetBricks = this.bricks.filter(b => !b.indestructible);
        const targets = targetBricks.slice(0, 3);

        targets.forEach((target, i) => {
            this.missiles.push({
                x: this.paddle.x + this.paddle.width / 2 + (i-1)*18,
                y: this.paddle.y,
                targetX: target.x + target.width / 2,
                targetY: target.y + target.height / 2,
                speed: 5,
                trail: [],
                life: 1
            });
        });
    }

    updateLasers(dt) {
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];
            laser.y += laser.dy * dt;

            if (laser.y < 0) {
                this.lasers.splice(i, 1);
                continue;
            }

            // Check brick collisions
            for (let j = this.bricks.length - 1; j >= 0; j--) {
                const brick = this.bricks[j];
                if (laser.x < brick.x + brick.width &&
                    laser.x + laser.width > brick.x &&
                    laser.y < brick.y + brick.height &&
                    laser.y + laser.height > brick.y) {

                    if (!brick.indestructible) {
                        if (this.stageStats) {
                            this.damageBrick(brick,1,'laser');
                            this.lasers.splice(i,1);
                            break;
                        }
                        brick.hits--;
                        this.score += 5;
                        this.spawnBrickParticles(brick);
                        if (brick.hits <= 0) {
                            this.bricks.splice(j, 1);
                            if (brick.explosive) this.explodeBrick(brick, -1);
                            this.maybeDropPowerUp(brick);
                        }
                    }
                    this.lasers.splice(i, 1);
                    break;
                }
            }
        }
    }

    updateMissiles(dt) {
        for (let i = this.missiles.length - 1; i >= 0; i--) {
            const m = this.missiles[i];
            const dx = m.targetX - m.x;
            const dy = m.targetY - m.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 10) {
                // Explode at target
                this.screenShake = 5;
                for (let j = 0; j < 15; j++) {
                    const angle = Math.random() * Math.PI * 2;
                    this.particles.push({
                        x: m.x, y: m.y,
                        dx: Math.cos(angle) * (2 + Math.random() * 4),
                        dy: Math.sin(angle) * (2 + Math.random() * 4),
                        life: 1, decay: 0.03,
                        color: '#ff4444', size: 3 + Math.random() * 3,
                        type: 'explosion'
                    });
                }

                // Damage bricks near impact
                for (let j = this.bricks.length - 1; j >= 0; j--) {
                    const brick = this.bricks[j];
                    const bx = brick.x + brick.width / 2 - m.x;
                    const by = brick.y + brick.height / 2 - m.y;
                    if (Math.sqrt(bx * bx + by * by) < 60 && !brick.indestructible) {
                        if(this.stageStats) {
                            this.damageBrick(brick,2,'missile');
                            continue;
                        }
                        brick.hits -= 2;
                        this.spawnBrickParticles(brick);
                        if (brick.hits <= 0) {
                            this.score += brick.points;
                            this.bricks.splice(j, 1);
                        }
                    }
                }

                this.missiles.splice(i, 1);
                continue;
            }

            m.x += (dx / dist) * m.speed * dt;
            m.y += (dy / dist) * m.speed * dt;
            m.trail.push({ x: m.x, y: m.y, alpha: 1 });
            if (m.trail.length > 10) m.trail.shift();
            m.trail.forEach(t => t.alpha *= 0.85);
        }
    }

    updatePowerTimers(deltaTime) {
        if (this.expandTimer > 0) {
            this.expandTimer -= deltaTime;
            if (this.expandTimer <= 0 && this.paddle) this.paddle.width = this.paddle.baseWidth;
        }
        if (this.shrinkTimer > 0) {
            this.shrinkTimer -= deltaTime;
            if (this.shrinkTimer <= 0 && this.paddle) this.paddle.width = this.paddle.baseWidth;
        }
        if (this.slowActive) {
            this.slowTimer -= deltaTime;
            if (this.slowTimer <= 0) {
                this.slowActive = false;
                this.balls.forEach(b => { b.dx /= .68; b.dy /= .68; b.speed /= .68; });
            }
        }
        if (this.electricActive) {
            this.electricTimer -= deltaTime;
            if (this.electricTimer <= 0) this.electricActive = false;
        }
        if (this.shieldActive) {
            this.shieldTimer -= deltaTime;
            if (this.shieldTimer <= 0) this.shieldActive = false;
        }
        if (this.magnetActive) {
            this.magnetTimer -= deltaTime;
            if (this.magnetTimer <= 0) this.magnetActive = false;
        }
        if (this.fireballActive) {
            this.fireballTimer -= deltaTime;
            if (this.fireballTimer <= 0) this.fireballActive = false;
        }
        if (this.laserActive) {
            this.laserTimer -= deltaTime;
            if (this.laserTimer <= 0) this.laserActive = false;
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.dx * dt;
            p.y += p.dy * dt;
            p.life -= p.decay * dt;
            if (p.type === 'explosion' || p.type === 'brick') {
                p.dy += 0.1 * dt; // gravity
            }
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    loseLife() {
        window.GaiaSound?.lose();
        this.lives--;
        this.combo = 0;
        this.clearPowerEffects();
        this.screenShake = 10;
        this.flashAlpha = 0.5;

        if (this.lives <= 0) {
            this.state = 'gameOver';
            this.onRoundEnd?.(this.state);
            return;
        }

        // Reset ball
        const level = this.levelsConfig.levels[this.currentLevel];
        this.balls = [{
            x: this.paddle.x + this.paddle.width / 2,
            y: this.paddle.y - 12,
            radius: 11,
            dx: level.ballSpeed * 0.7,
            dy: -level.ballSpeed,
            speed: level.ballSpeed,
            baseSpeed: level.ballSpeed,
            trail: []
        }];
        this.ballAttached = true;
    }

    // Particle spawning helpers
    spawnBrickParticles(brick) {
        for (let i = 0; i < 11; i++) {
            this.particles.push({
                x: brick.x + Math.random() * brick.width,
                y: brick.y + Math.random() * brick.height,
                dx: (Math.random() - 0.5) * 4,
                dy: (Math.random() - 0.5) * 4,
                life: 1,
                decay: 0.02 + Math.random() * 0.02,
                color: brick.color1,
                size: 2 + Math.random() * 4,
                type: 'brick'
            });
        }
    }

    spawnWallParticles(x, y) {
        for (let i = 0; i < 5; i++) {
            this.particles.push({
                x, y,
                dx: (Math.random() - 0.5) * 3,
                dy: (Math.random() - 0.5) * 3,
                life: 1, decay: 0.04,
                color: '#ffffff', size: 2,
                type: 'spark'
            });
        }
    }

    spawnPaddleParticles(x) {
        for (let i = 0; i < 6; i++) {
            this.particles.push({
                x, y: this.paddle.y,
                dx: (Math.random() - 0.5) * 4,
                dy: -1 - Math.random() * 3,
                life: 1, decay: 0.03,
                color: this.selectedShip.color1, size: 3,
                type: 'spark'
            });
        }
    }

    spawnShieldParticles(x) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 40,
                y: this.height - 15,
                dx: (Math.random() - 0.5) * 2,
                dy: -2 - Math.random() * 2,
                life: 1, decay: 0.03,
                color: '#00ccff', size: 3,
                type: 'spark'
            });
        }
    }

    spawnSparkParticles(x, y) {
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            this.particles.push({
                x, y,
                dx: Math.cos(angle) * 3,
                dy: Math.sin(angle) * 3,
                life: 1, decay: 0.05,
                color: '#aaaaaa', size: 2,
                type: 'spark'
            });
        }
    }

    // Main game loop
    gameLoop(timestamp) {
        try {
            this.deltaTime = Math.max(0, Math.min(120, timestamp - this.lastTime));
            this.lastTime = timestamp;
            // Keep ball physics near real time when a device drops frames. Render
            // once, but catch up with bounded, small collision-safe steps.
            this.stepRemainder = (this.stepRemainder || 0) + this.deltaTime;
            let steps = 0;
            while (this.stepRemainder >= 16.67 && steps < 6) {
                this.update(16.67);
                this.stepRemainder -= 16.67;
                steps++;
            }
            if (steps === 6) this.stepRemainder = Math.min(this.stepRemainder, 16.67);
            this.render();
        } catch (error) {
            const message = String(error?.message || error);
            if (message !== this.lastFrameError) {
                console.error('GAIA frame error:', error);
                this.lastFrameError = message;
            }
        } finally {
            // One draw/audio exception must not permanently stop the game clock.
            this.animationFrame = requestAnimationFrame((t) => this.gameLoop(t));
        }
    }

    start() {
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);
    }

    stop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }
}
