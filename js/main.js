// GAIA HEART BREAKER — offline-first playable edition.
(async function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const canvas = $('gameCanvas');
    const engine = new GameEngine(canvas);
    await engine.loadConfigs();

    if (window.GAIA_40_STAGES?.length===40) {
        engine.levelsConfig.levels=window.GAIA_40_STAGES;
    }
    // This build is a three-gimmick playtest, not the unbalanced 40-round tour.
    // Keep all forty scene definitions and saved progress intact for later.
    const prototypeScenes=['PARK_GOAL1','ROOM_REVEAL','CASINO_BET'];
    const prototypeIndices=prototypeScenes.map(scene=>
        engine.levelsConfig.levels.findIndex(level=>level.sceneKey===scene));
    if(prototypeIndices.some(index=>index<0))throw new Error('Missing prototype stage');
    const elasticScenes=['CASINO_DOUBLE','CASINO_TIMING','CLUB_NEON','CLUB_CHAIN','POLICE_TEST','POLICE_BARRIER'];
    const elasticIndices=elasticScenes.map(key=>engine.levelsConfig.levels.findIndex(s=>s.sceneKey===key));
    if(elasticIndices.some(index=>index<0))throw new Error('Missing elastic character stage');

    // Keep existing controls, paddle, powers and sound; use authored forty rounds.
    // selection with one readable paddle whose upgrades appear in play.
    const standardShip = engine.shipsConfig.ships[1];
    engine.selectedShip = { ...standardShip, id:'gaia', name:'가이아 패들', width:138, height:25, speed:12 };
    engine.powersConfig.powers.push(
        {id:'shrink',name:'미니 패들',description:'잠시 패들이 짧아집니다',icon:'↘',color:'#ff9d69',duration:7500,dropChance:.055,effect:'shrink'},
        {id:'electric',name:'전기 충격',description:'주변 블록까지 번개가 튑니다',icon:'⚡',color:'#82eaff',duration:8500,dropChance:.085,effect:'electric'},
        {id:'life',name:'하트 충전',description:'목숨을 하나 회복합니다',icon:'♥',color:'#ffa8c3',duration:0,dropChance:.025,effect:'life'}
    );
    engine.loadLevel(prototypeIndices[0]);
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
    const storageKey = 'gaia-heart-breaker-40-v2';
    const dialogueKey = 'gaia-heart-breaker-dialogue-mode-v1';
    let dialogueMode='normal';
    try { if(localStorage.getItem(dialogueKey)==='hardcore') dialogueMode='hardcore'; } catch (_) {}
    let stageDialogueShown=false,eventExpires=0,settingsWasPlaying=false,demoMode=false,prototypeTour=false,elasticTour=false;
    const triggerByScene={
        MART_BASIC:'solid',MART_JELLY:'jelly',MART_METAL:'metal',MART_BOMB:'bomb',MART_FINALE:'quickChain',
        PARK_GOAL1:'soccer',PARK_JELLY:'soccer',PARK_MOVING:'soccer',PARK_DEFENSE:'soccer',PARK_FINAL:'soccer',
        ROOM_REVEAL:'reveal',ROOM_TWICE:'reflect',ROOM_DUO:'reflect',ROOM_GUARD:'reflect',ROOM_FINAL:'reflect',
        STUDIO_TAKE1:'basket',STUDIO_MOVE:'basket',STUDIO_DOUBLE:'basket',STUDIO_NG:'basket',STUDIO_FINAL:'basket',
        CASINO_BET:'metalBarrier',CASINO_DOUBLE:'metalBarrier',CASINO_POISON:'poison',
        CASINO_TIMING:'metalBarrier',CASINO_FINAL:'jackpot',
        FARM_PIN1:'pin',FARM_PIN2:'pin',FARM_PIN3:'pin',FARM_MOVE:'pin',FARM_FINAL:'pin',
        CLUB_NEON:'neon',CLUB_CHAIN:'lightning',CLUB_SQUAT:'reflect',CLUB_FAST:'reflect',CLUB_FINAL:'reflect',
        POLICE_TEST:'solid',POLICE_BARRIER:'metalBarrier',POLICE_DUAL:'basket',
        POLICE_PRACTICAL:'reflect',POLICE_ENDING:'heart'
    };
    function currentDialogue() {
        const key=engine.levelsConfig.levels[engine.currentLevel]?.sceneKey;
        return window.GAIA_DIALOGUES?.[dialogueMode]?.[key]||null;
    }
    function showStageIntro() {
        const entry=currentDialogue();
        if(!entry) return;
        const level=engine.levelsConfig.levels[engine.currentLevel];
        $('dialogueStage').textContent=`${String(level.stageId).padStart(2,'0')} / 40 · ${level.name}`;
        $('dialogueMale').textContent=entry.male;
        $('dialogueFemale').textContent=entry.female;
        if(['PARK_GOAL1','ROOM_REVEAL','CASINO_BET'].includes(level.sceneKey)) {
            $('heroImage').src=faces.arrival;
            $('heroImage').dataset.mode='arrival';
        }
        engine.state='dialogue'; // Intro must finish before physics advances.
        oldState='dialogue';
        window.GaiaSound?.pause();
        show('dialogueScreen');
    }
    function showStageEvent(line) {
        if(!line) return;
        $('eventDialogue').textContent=line;
        $('eventDialogue').classList.remove('hidden');
        eventExpires=performance.now()+5600;
    }
    function clearStageEvent() {
        eventExpires=0;
        $('eventDialogue').classList.add('hidden');
    }
    function setDialogueMode(next) {
        dialogueMode=next==='hardcore'?'hardcore':'normal';
        try {localStorage.setItem(dialogueKey,dialogueMode);} catch (_) {}
        $('normalMode').setAttribute('aria-pressed',String(dialogueMode==='normal'));
        $('hardcoreMode').setAttribute('aria-pressed',String(dialogueMode==='hardcore'));
        if(engine.state==='dialogue') showStageIntro();
        if(['levelComplete','victory'].includes(engine.state)) {
            $('resultDescription').textContent=currentDialogue()?.clear||'감사합니다. 수고하셨습니다♡';
        }
    }
    let progress = {best:0,unlocked:0};
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (saved && Number.isFinite(saved.best) && Number.isInteger(saved.unlocked)) {
            progress = { best:Math.max(0,saved.best), unlocked:Math.max(0,Math.min(total-1,saved.unlocked)) };
        } else {
            // Old eight-venue progress maps to the first tier of each venue.
            const previous40=JSON.parse(localStorage.getItem('gaia-heart-breaker-40-v1')||'null');
            if(previous40 && Number.isInteger(previous40.unlocked)) {
                // The previous edition mixed all eight venues; preserve the
                // previously reached scene when restoring original script order.
                const circuit=[[0,5,1,3,2,6,4,7],[1,0,6,2,5,4,3,7],
                    [5,2,0,4,3,1,7,6],[4,1,3,5,6,2,0,7],
                    [0,2,3,4,5,1,6,7]];
                const oldIndex=Math.max(0,Math.min(39,previous40.unlocked));
                const venueIndex=circuit[Math.floor(oldIndex/8)][oldIndex%8];
                progress={best:Math.max(0,previous40.best||0),unlocked:venueIndex*5+Math.floor(oldIndex/8)};
            }
            const previous=JSON.parse(localStorage.getItem('gaia-heart-breaker-arcade-v1')||'null');
            if(previous && Number.isInteger(previous.unlocked))
                if(!previous40)progress={best:Math.max(0,previous.best||0),unlocked:Math.min(total-1,previous.unlocked*5)};
        }
    } catch (_) { /* Private/offline browsers may disable localStorage. */ }
    function save() {
        try { localStorage.setItem(storageKey, JSON.stringify(progress)); } catch (_) { /* optional */ }
    }

    const asset = window.GaiaAssetUrl || (url=>url);
    const portraitBase='assets/characters/cutouts/03_portraits/';
    const faceSets={
        brown:{idle:'P02_brown_red_01.png',hit:'P02_brown_red_02.png',
            win:'P02_brown_red_03.png',shy:'P02_brown_red_04.png',
            arrival:'P05_brown_jacket_01.png',cheer:'P06_brown_jacket_cheer.png'},
        choseon:{idle:'P01_choseon_pink_01.png',hit:'P01_choseon_pink_02.png',
            win:'P01_choseon_pink_03.png',shy:'P01_choseon_pink_04.png',
            arrival:'P03_choseon_royal_01.png',cheer:'P06_choseon_royal_cheer.png'}
    };
    for(const group of Object.values(faceSets)) for(const key of Object.keys(group))
        group[key]=asset(portraitBase+group[key]);
    let faces=faceSets.brown;
    Object.values(faceSets).flatMap(Object.values).forEach(url => { const img = new Image(); img.src = url; });
    let reactionHold = 0, faceReset = 0, oldState = 'menu', lastDom = 0;
    const quips = ['아얏… 감사합니다♡','으윽… 감사합니다♡','아앗! 감사합니다♡','깜짝 놀랐습니다…♡','아휴… 수고하셨습니다♡','아앗… 정말 감사합니다♡'];
    function react(sentence, mode = 'hit', hold = 1000, force = false) {
        const now = performance.now();
        if (!force && now < reactionHold) return false;
        reactionHold = now + Math.max(600,hold*.55);
        faceReset = now + hold;
        if(sentence) $('reaction').textContent = sentence;
        const hero = $('heroImage');
        if (hero.dataset.mode !== mode) {
            hero.src = faces[mode] || faces.idle;
            hero.dataset.mode = mode;
        }
        hero.classList.remove('bounce','hit');
        void hero.offsetWidth;
        hero.classList.add(mode === 'win'||mode==='cheer' ? 'bounce' : 'hit');
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
    engine.onStageEvent=(event)=>{
        const scene=engine.levelsConfig.levels[engine.currentLevel]?.sceneKey;
        const entry=currentDialogue();
        if(!scene||!entry) return;
        if(event.type==='bodyHit') {
            react(null,event.zone==='hip'?'hit':event.zone==='waist'?'shy':'win',1350);
            return;
        }
        if(scene==='POLICE_ENDING' && event.type==='heart') {
            if(event.target?.count===2) showStageEvent(entry.trigger);
            if(event.target?.count===3) showStageEvent(entry.extras?.[0]);
            return;
        }
        const matching=event.type===triggerByScene[scene] ||
            (scene==='POLICE_DUAL' && event.type==='soccer');
        if(stageDialogueShown||!matching) return;
        const finishEvents=new Set(['PARK_JELLY','PARK_DEFENSE','STUDIO_DOUBLE',
            'STUDIO_NG','STUDIO_FINAL','CASINO_FINAL','FARM_PIN2','POLICE_PRACTICAL']);
        if(finishEvents.has(scene) && engine.targets.some(t=>t.count<t.required)) return;
        if(scene==='PARK_FINAL' && event.target?.count<2) return;
        if(scene==='POLICE_DUAL' && engine.targets.some(t=>t.count<t.required)) return;
        stageDialogueShown=true;
        showStageEvent(entry.trigger);
        react(null,'win',1700,true);
    };

    function setStageVisuals() {
        const index = engine.currentLevel;
        const level=engine.levelsConfig.levels[index];
        const venue=level?.chapter??index;
        faces=faceSets[level?.character]||faceSets.brown;
        $('heroImage').src=faces.idle;
        $('heroImage').dataset.mode='idle';
        $('locationName').textContent = `${locations[venue] || '가이아 시티'} · ${level?.name || ''}`;
        $('sceneBackdrop').style.backgroundImage = `url('${asset(`assets/backgrounds/stage${venue+1}.png`)}')`;
    }
    function show(id) { $(id).classList.remove('hidden'); }
    function hide(id) { $(id).classList.add('hidden'); }
    function mainMenu() {
        demoMode=false;prototypeTour=false;elasticTour=false;
        window.GaiaSound?.stop();
        engine.resetGame();
        engine.loadLevel(prototypeIndices[0]);
        engine.state = 'menu';
        clearStageEvent();
        oldState = 'menu';
        setStageVisuals();
        hide('pauseScreen'); hide('messageScreen');hide('dialogueScreen');hide('settingsScreen');show('menuScreen');
        // Old 40-round progress remains saved; it is intentionally not a
        // playable path until its scene rules and difficulty are reviewed.
        $('continueButton').hidden = true;
        $('reaction').textContent = '오늘은 살살 부탁드려요…♡';
        $('heroImage').src = faces.idle;
        $('heroImage').dataset.mode = 'idle';
    }
    function begin(stage=prototypeIndices[0],showcase=false,tour=false,elastic=false) {
        demoMode=showcase;
        prototypeTour=tour;
        elasticTour=elastic;
        engine.startGame();
        stageDialogueShown=false;
        clearStageEvent();
        pocketStock.heart=3; pocketStock.ice=3; pocketStock.bolt=3;
        engine.loadLevel(stage);
        engine.state = 'playing';
        engine.mouseX = engine.width/2;
        engine.usingKeyboard = false;
        oldState = 'playing';
        setStageVisuals();
        hide('menuScreen'); hide('messageScreen'); hide('pauseScreen');hide('settingsScreen');
        react(stage ? '다시 찾아주셔서 감사합니다♡' : '오늘도 잘 부탁드립니다♡','idle',1000,true);
        window.GaiaSound?.start(engine.currentLevel);
        window.GaiaSound?.powerUp();
        showStageIntro();
    }
    function showResult(type) {
        const won=type==='victory',clear=type==='levelComplete';
        if (engine.score>progress.best) progress.best=engine.score;
        if (clear && !demoMode) progress.unlocked=Math.max(progress.unlocked, Math.min(total-1,engine.currentLevel+1));
        save();
        const title=won?'ALL CLEAR!':clear?'STAGE CLEAR!':'GAME OVER';
        $('resultIcon').textContent=won?'♛':clear?'♥':'♡';
        $('resultTitle').textContent=title;
        const lines=currentDialogue();
        const conclusion=lines?.clear||'감사합니다. 수고하셨습니다♡';
        $('resultDescription').textContent=won&&lines?.extras?.length?
            `${lines.extras[0]}\n\n${conclusion}`:(clear?conclusion:won?conclusion:'다시 도전하시면 더 잘하실 거예요.');
        $('resultScore').textContent=engine.score.toLocaleString()+' PT';
        const currentTour=elasticTour?elasticIndices:prototypeIndices;
        const indexInTour=currentTour.indexOf(engine.currentLevel);
        $('resultButton').textContent=elasticTour?
            (clear?(indexInTour===currentTour.length-1?'6종 시험 종료 · 메인으로':'다음 숨은 캐릭터 ▶'):'이 판 다시 ▶'):prototypeTour?
            (clear?(indexInTour===prototypeIndices.length-1?'3종 시범 종료 · 메인으로':'다음 기믹 ▶'):'이 기믹 다시 ▶'):
            demoMode?'시범판 종료 · 메인으로':clear?'다음 스테이지 ▶':'다시 도전 ▶';
        hide('pauseScreen');show('messageScreen');
        const prototype=['PARK_GOAL1','ROOM_REVEAL','CASINO_BET'].includes(
            engine.levelsConfig.levels[engine.currentLevel]?.sceneKey);
        react(won?'정말 감사합니다. 수고하셨습니다♡':clear?'감사합니다! 수고하셨습니다♡':'수고하셨습니다. 감사합니다♡',
            clear||won?(prototype?'cheer':'win'):'hit',3000,true);
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

    $('startButton').addEventListener('click',()=>begin(prototypeIndices[0],true,true));
    $('elasticDemoButton').addEventListener('click',()=>begin(elasticIndices[0],true,false,true));
    $('goalDemoButton').addEventListener('click',()=>{
        const goalIndex=engine.levelsConfig.levels.findIndex(level=>level.sceneKey==='PARK_GOAL1');
        if(goalIndex>=0)begin(goalIndex,true);
    });
    for(const [button,sceneKey] of [['revealDemoButton','ROOM_REVEAL'],['hopDemoButton','CASINO_BET']])
        $(button).addEventListener('click',()=>{
            const index=engine.levelsConfig.levels.findIndex(level=>level.sceneKey===sceneKey);
            if(index>=0)begin(index,true);
        });
    $('continueButton').addEventListener('click',()=>begin(progress.unlocked));
    $('resultButton').addEventListener('click',()=>{
        if(prototypeTour || elasticTour) {
            const elastic=elasticTour;
            const tourStages=elastic?elasticIndices:prototypeIndices;
            if(engine.state!=='levelComplete') {
                begin(engine.currentLevel,true,!elastic,elastic);return;
            }
            const index=tourStages.indexOf(engine.currentLevel);
            if(index<0 || index===tourStages.length-1){mainMenu();return;}
            // Preserve the score and remaining lives between the three tests,
            // but never progress into an unfinished normal stage.
            engine.lives=Math.min(5,engine.lives+1);
            engine.loadLevel(tourStages[index+1]);
            stageDialogueShown=false;clearStageEvent();
            oldState='playing';setStageVisuals();hide('messageScreen');
            try{window.GaiaSound?.setStage(engine.currentLevel);}catch(_){/* optional audio */}
            showStageIntro();return;
        }
        if(demoMode){mainMenu();return;}
        if (engine.state==='levelComplete') {
            engine.lives=Math.min(5,engine.lives+1); // Modest reward for clearing a floor.
            engine.nextLevel();
            stageDialogueShown=false;
            clearStageEvent();
            oldState='playing';setStageVisuals();hide('messageScreen');
            react('이번에도 잘 부탁드립니다♡','idle',900,true);
            try { window.GaiaSound?.setStage(engine.currentLevel); } catch (_) { /* optional audio */ }
            showStageIntro();
        } else begin(prototypeIndices[0]);
    });
    $('dialogueStart').addEventListener('click',()=>{
        hide('dialogueScreen');
        $('heroImage').src=faces.idle;
        $('heroImage').dataset.mode='idle';
        engine.state='playing';oldState='playing';
        engine.lastTime=performance.now();
        window.GaiaSound?.resume();
    });
    $('settingsButton').addEventListener('click',()=>{
        settingsWasPlaying=engine.state==='playing';
        if(settingsWasPlaying) pause();
        show('settingsScreen');
    });
    $('settingsClose').addEventListener('click',()=>{
        hide('settingsScreen');
        if(settingsWasPlaying) resume();
        settingsWasPlaying=false;
    });
    $('normalMode').addEventListener('click',()=>setDialogueMode('normal'));
    $('hardcoreMode').addEventListener('click',()=>setDialogueMode('hardcore'));
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
        if(eventExpires>0 && now>eventExpires) {
            eventExpires=0;$('eventDialogue').classList.add('hidden');
        }
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
        $('mobileStage').textContent=`${String(engine.currentLevel+1).padStart(2,'0')}/${total} · ${engine.levelsConfig.levels[engine.currentLevel]?.name||''}`;
        $('mobileScore').textContent=`SCORE ${engine.score.toLocaleString()}`;
        for (const name of ['heart','ice','bolt']) {
            $(name+'Count').textContent='×'+pocketStock[name];
            $(name+'Pocket').disabled=engine.state!=='playing'||pocketStock[name]<=0;
        }
        $('comboText').textContent=engine.combo>=3?`${engine.combo} COMBO!`:'♡ '+(engine.bricks.filter(b=>!b.indestructible).length)+' BLOCKS';
        $('goalStatus').textContent=engine.stageGoalText();
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
    setDialogueMode(dialogueMode);
    $('continueButton').hidden=true;
})();
