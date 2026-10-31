// GAIA HEART BREAKER — offline-first playable edition.
(async function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const canvas = $('gameCanvas');
    const engine = new GameEngine(canvas);
    await engine.loadConfigs();

    // Keep the eight original stage layouts and physics, replace the spaceship
    // selection with one readable paddle whose upgrades appear in play.
    const standardShip = engine.shipsConfig.ships[1];
    engine.selectedShip = { ...standardShip, id:'gaia', name:'가이아 패들', width:138, height:25, speed:12 };
    engine.powersConfig.powers.push(
        {id:'shrink',name:'미니 패들',description:'잠시 패들이 짧아집니다',icon:'↘',color:'#ff9d69',duration:7500,dropChance:.055,effect:'shrink'},
        {id:'electric',name:'전기 충격',description:'주변 블록까지 번개가 튑니다',icon:'⚡',color:'#82eaff',duration:8500,dropChance:.085,effect:'electric'},
        {id:'life',name:'하트 충전',description:'목숨을 하나 회복합니다',icon:'♥',color:'#ffa8c3',duration:0,dropChance:.025,effect:'life'}
    );
    engine.loadLevel(0);
    engine.state = 'menu';
    const renderer = new Renderer(engine);
    window.gaiaTestEngine = engine; // Accessible to local, non-network smoke tests.

    const total = engine.levelsConfig.levels.length;
    const locations = ['핑크 마트','하트 공원','비밀의 방','촬영 스튜디오','가이아 카지노','캔디 농장','호스트 클럽','가이아 경찰서'];
    // The three illustrated portrait pockets are real, limited-use powers.
    const pocketStock = { heart:3, ice:3, bolt:3 };
    const pocketPowers = {
        heart:()=>engine.powersConfig.powers.find(p=>p.effect==='life'),
        ice:()=>engine.powersConfig.powers.find(p=>p.effect==='slow'),
        bolt:()=>engine.powersConfig.powers.find(p=>p.effect==='electric')
    };
    const storageKey = 'gaia-heart-breaker-arcade-v1';
    let progress = {best:0,unlocked:0};
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (saved && Number.isFinite(saved.best) && Number.isInteger(saved.unlocked)) {
            progress = { best:Math.max(0,saved.best), unlocked:Math.max(0,Math.min(total-1,saved.unlocked)) };
        }
    } catch (_) { /* Private/offline browsers may disable localStorage. */ }
    function save() {
        try { localStorage.setItem(storageKey, JSON.stringify(progress)); } catch (_) { /* optional */ }
    }

    const asset = window.GaiaAssetUrl || (url=>url);
    const faces = {
        idle:asset('assets/characters/hero-idle.png'),
        hit:asset('assets/characters/hero-hit.png'),
        win:asset('assets/characters/hero-win.png'),
        shy:asset('assets/characters/hero-shy.png')
    };
    Object.values(faces).forEach(url => { const img = new Image(); img.src = url; });
    let reactionHold = 0, faceReset = 0, oldState = 'menu', lastDom = 0;
    const quips = ['아얏… 감사합니다♡','으윽… 감사합니다♡','아앗! 감사합니다♡','깜짝 놀랐습니다…♡','아휴… 수고하셨습니다♡','아앗… 정말 감사합니다♡'];
    function react(sentence, mode = 'hit', hold = 1000, force = false) {
        const now = performance.now();
        if (!force && now < reactionHold) return false;
        reactionHold = now + Math.max(600,hold*.55);
        faceReset = now + hold;
        $('reaction').textContent = sentence;
        const hero = $('heroImage');
        if (hero.dataset.mode !== mode) {
            hero.src = faces[mode] || faces.idle;
            hero.dataset.mode = mode;
        }
        hero.classList.remove('bounce','hit');
        void hero.offsetWidth;
        hero.classList.add(mode === 'win' ? 'bounce' : 'hit');
        return true;
    }
    engine.onBrickHit = (brick, destroyed) => {
        if (engine.combo >= 6 && engine.combo % 6 === 0) {
            react(`${engine.combo}콤보… 정말 감사합니다♡`, 'win', 1300, true);
            window.GaiaSound?.voice('happy');
        } else if (destroyed) {
            const accepted = react(quips[(Math.floor(engine.score/11)+engine.combo) % quips.length], engine.combo % 3 === 0 ? 'shy' : 'hit', 900);
            if (accepted) window.GaiaSound?.voice(['surprise','effort','yelp','whimper'][engine.combo % 4]);
        }
    };

    function setStageVisuals() {
        const index = engine.currentLevel;
        $('locationName').textContent = locations[index] || `스테이지 ${index+1}`;
        $('sceneBackdrop').style.backgroundImage = `url('${asset(`assets/backgrounds/stage${index+1}.png`)}')`;
    }
    function show(id) { $(id).classList.remove('hidden'); }
    function hide(id) { $(id).classList.add('hidden'); }
    function mainMenu() {
        window.GaiaSound?.stop();
        engine.resetGame();
        engine.loadLevel(0);
        engine.state = 'menu';
        oldState = 'menu';
        setStageVisuals();
        hide('pauseScreen'); hide('messageScreen'); show('menuScreen');
        $('continueButton').hidden = !(progress.unlocked > 0);
        $('reaction').textContent = '오늘은 살살 부탁드려요…♡';
        $('heroImage').src = faces.idle;
        $('heroImage').dataset.mode = 'idle';
    }
    function begin(stage=0) {
        engine.startGame();
        pocketStock.heart=3; pocketStock.ice=3; pocketStock.bolt=3;
        if (stage > 0) engine.loadLevel(stage);
        engine.state = 'playing';
        engine.mouseX = engine.width/2;
        engine.usingKeyboard = false;
        oldState = 'playing';
        setStageVisuals();
        hide('menuScreen'); hide('messageScreen'); hide('pauseScreen');
        react(stage ? '다시 찾아주셔서 감사합니다♡' : '오늘도 잘 부탁드립니다♡','idle',1000,true);
        window.GaiaSound?.start(engine.currentLevel);
        window.GaiaSound?.powerUp();
    }
    function showResult(type) {
        const won=type==='victory',clear=type==='levelComplete';
        if (engine.score>progress.best) progress.best=engine.score;
        if (clear) progress.unlocked=Math.max(progress.unlocked, Math.min(total-1,engine.currentLevel+1));
        save();
        const title=won?'ALL CLEAR!':clear?'STAGE CLEAR!':'GAME OVER';
        $('resultIcon').textContent=won?'♛':clear?'♥':'♡';
        $('resultTitle').textContent=title;
        $('resultDescription').textContent=won?'모든 장소를 돌파하셨습니다!':clear?'다음 장소가 열렸습니다.':'다시 도전하시면 더 잘하실 거예요.';
        $('resultScore').textContent=engine.score.toLocaleString()+' PT';
        $('resultButton').textContent=clear?'다음 스테이지 ▶':'다시 도전 ▶';
        hide('pauseScreen');show('messageScreen');
        react(won?'정말 감사합니다. 수고하셨습니다♡':clear?'감사합니다! 수고하셨습니다♡':'수고하셨습니다. 감사합니다♡',clear||won?'win':'hit',3000,true);
        try {
            if (clear || won) {
                window.GaiaSound?.levelUp();
                window.GaiaSound?.voice('happy', true);
            }
        } catch (_) { /* The result screen must work even if audio fails. */ }
    }
    // Show the result in the same physics step as the final block collision.
    // Previously this depended entirely on a later canvas render, which could
    // leave mobile browsers looking frozen if that render failed or stalled.
    engine.onRoundEnd = type => {
        if (oldState === type) return;
        showResult(type);
        oldState = type;
    };
    function pause() {
        if (engine.state !== 'playing') return;
        engine.state='paused'; show('pauseScreen'); $('pauseButton').textContent='▶';
        window.GaiaSound?.pause();
    }
    function resume() {
        if (engine.state !== 'paused') return;
        engine.state='playing';hide('pauseScreen');$('pauseButton').textContent='Ⅱ';
        engine.lastTime=performance.now();
        window.GaiaSound?.resume();
    }

    $('startButton').addEventListener('click',()=>begin(0));
    $('continueButton').addEventListener('click',()=>begin(progress.unlocked));
    $('resultButton').addEventListener('click',()=>{
        if (engine.state==='levelComplete') {
            engine.lives=Math.min(5,engine.lives+1); // Modest reward for clearing a floor.
            engine.nextLevel();
            oldState='playing';setStageVisuals();hide('messageScreen');
            react('이번에도 잘 부탁드립니다♡','idle',900,true);
            try { window.GaiaSound?.setStage(engine.currentLevel); } catch (_) { /* optional audio */ }
        } else begin(0);
    });
    $('resultHome').addEventListener('click',mainMenu);
    $('pauseHome').addEventListener('click',mainMenu);
    $('resumeButton').addEventListener('click',resume);
    $('pauseButton').addEventListener('click',()=>engine.state==='paused'?resume():pause());
    $('soundButton').addEventListener('click',()=>{
        if (!window.GaiaSound) return;
        window.GaiaSound.setEnabled(!window.GaiaSound.enabled);
        $('soundButton').textContent=window.GaiaSound.enabled?'♫':'♪̸';
    });
    for (const name of ['heart','ice','bolt']) {
        $(name+'Pocket').addEventListener('click',()=>{
            if (engine.state!=='playing' || pocketStock[name]<=0) return;
            const power=pocketPowers[name]();
            if (!power) return;
            pocketStock[name]--;
            engine.activatePower(power);
            react(name==='heart'?'하트 충전이에요!♡':name==='ice'?'조금 천천히 가볼까요?': '찌릿! 전기가 통했어요♡','win',850,true);
        });
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
    window.addEventListener('keydown',e=>{
        if ((e.key==='Escape'||e.key==='p'||e.key==='P') && engine.state==='playing') {
            // Engine already handles lower-case p itself; sync the HTML overlay.
            if (e.key!=='p') pause();
        } else if ((e.key==='Escape'||e.key==='P') && engine.state==='paused') resume();
        if (e.key==='Enter' && engine.state==='menu') begin(0);
    });

    function updateUi(now) {
        if (oldState!==engine.state) {
            if (['levelComplete','gameOver','victory'].includes(engine.state)) showResult(engine.state);
            oldState=engine.state;
            if (oldState==='paused') { show('pauseScreen'); window.GaiaSound?.pause(); }
            if (oldState==='playing') { hide('pauseScreen'); window.GaiaSound?.resume(); }
        }
        if (now < faceReset && engine.state==='playing') { /* Hold the current expression. */ }
        else if (now >= faceReset && $('heroImage').dataset.mode!=='idle' && engine.state==='playing') {
            $('heroImage').src=faces.idle; $('heroImage').dataset.mode='idle';
        }
        if (now-lastDom < 90) return;
        lastDom=now;
        $('stageNumber').textContent=`${String(engine.currentLevel+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;
        $('scoreNumber').textContent=engine.score.toLocaleString();
        $('lifeNumber').textContent='♥ '.repeat(engine.lives).trim() || '♡';
        $('mobileLives').textContent='♥ '.repeat(engine.lives).trim() || '♡';
        $('mobileStage').textContent=`STAGE ${String(engine.currentLevel+1).padStart(2,'0')}`;
        $('mobileScore').textContent=`SCORE ${engine.score.toLocaleString()}`;
        for (const name of ['heart','ice','bolt']) {
            $(name+'Count').textContent='×'+pocketStock[name];
            $(name+'Pocket').disabled=engine.state!=='playing'||pocketStock[name]<=0;
        }
        $('comboText').textContent=engine.combo>=3?`${engine.combo} COMBO!`:'♡ '+(engine.bricks.filter(b=>!b.indestructible).length)+' BLOCKS';
        $('bestScore').textContent='BEST '+Math.max(progress.best,engine.score).toLocaleString();
        $('launchHint').classList.toggle('show',engine.state==='playing'&&engine.ballAttached);
        const flags=[];
        if (engine.laserActive) flags.push('🔫 레이저');
        if (engine.magnetActive) flags.push('🧲 자석');
        if (engine.fireballActive) flags.push('🔥 관통공');
        if (engine.electricActive) flags.push('⚡ 전기');
        if (engine.shieldActive) flags.push('🛡 보호막');
        if (engine.slowActive) flags.push('❄ 저속');
        if (engine.paddle?.width>engine.paddle?.baseWidth*1.2) flags.push('↔ 확장');
        if (engine.paddle?.width<engine.paddle?.baseWidth*.85) flags.push('↘ 축소');
        $('activePowers').textContent=flags.join(' · ') || '● 기본 패들';
        $('pauseButton').textContent=engine.state==='paused'?'▶':'Ⅱ';
    }

    engine.render=()=>{renderer.render();updateUi(performance.now());};
    engine.start();
    setStageVisuals();
    $('continueButton').hidden=!(progress.unlocked>0);
})();
