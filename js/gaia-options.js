// GAIA HEART BREAKER — independent offline settings, haptics and folder slideshow.
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const key='gaia-heart-breaker-options-v1';
    const limit=v=>Math.min(1,Math.max(0,Number(v)||0));
    let saved={};
    try {saved=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){/* private mode */}
    const options={music:limit(saved.music??.54),effects:limit(saved.effects??1),
        haptics:saved.haptics!==false,slideSeconds:Math.min(20,Math.max(4,Number(saved.slideSeconds)||8))};
    const persist=()=>{try{localStorage.setItem(key,JSON.stringify(options));}catch(_){/* private mode */}};

    // Browser audio volume is normalized. Existing source samples and BGM remain unchanged.
    const sound=window.GaiaSound;
    if(sound){
        const makeAudio=sound.makeAudio.bind(sound);
        sound.makeAudio=function(name,volume){
            const clip=makeAudio(name,volume);
            if(clip&&!name.startsWith('bgm-'))clip.volume=Math.min(1,volume*options.effects);
            return clip;
        };
        const synth=sound.play.bind(sound);
        sound.play=function(freq,wave,duration,gain,endFreq){
            if(options.effects<=0)return;
            return synth(freq,wave,duration,gain*options.effects,endFreq);
        };
        sound.setMusicLevel=function(level){
            options.music=limit(level);this.musicVolume=.5*options.music;
            if(this.music){this.music.volume=this.enabled?this.musicVolume:0;}
            persist();
        };
        sound.setEffectsLevel=function(level){
            options.effects=limit(level);
            for(const [name,clip] of Object.entries(this.samples)){
                if(clip)clip.volume=(name.startsWith('slap-')?.69:.87)*options.effects;
            }
            persist();
        };
        sound.setMusicLevel(options.music);
    }

    const haptics={
        enabled:options.haptics,lastAt:{paddle:-1e6,body:-1e6,explosion:-1e6},
        // Deliberately strong for tablets: native amplitude is 255 (maximum).
        patterns:{paddle:[65],body:[90,35,105],explosion:[160,45,180,45,160]},
        pulse(kind,force=false){
            if(!this.enabled&&!force)return false;
            const pattern=this.patterns[kind]||this.patterns.body;
            const now=typeof performance!=='undefined'?performance.now():Date.now();
            const gap=kind==='explosion'?260:kind==='paddle'?75:125;
            if(!force&&now-(this.lastAt[kind]??-1e6)<gap)return false;
            let ok=false;
            try{
                // A future native Android APK can supply an actual bridge.
                const native=window.GaiaNativeVibration;
                if(native&&typeof native.vibrate==='function'){
                    ok=native.vibrate(JSON.stringify(pattern))!==false;
                }else if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function'){
                    ok=navigator.vibrate(pattern)!==false;
                }
            }catch(_){ok=false;}
            if(ok)this.lastAt[kind]=now;
            return ok;
        }
    };
    window.GaiaHaptics=haptics;
    // Engine and elastic-hazard collision code signal GaiaHaptics directly
    // at the confirmed contact point. Do not wrap the physics methods here:
    // a post-bounce geometry check previously suppressed real collisions.

    // User-selected image files are referenced by blob URLs, never uploaded.
    // A page reload needs folder selection again because local file access is permissioned.
    const background=$('sceneBackdrop');
    const layerA=$('slideLayerA'),layerB=$('slideLayerB');
    const layers=[layerA,layerB];
    let urls=[],randomOrder=[],orderAt=0,currentLayer=-1,timer=null;
    const status=$('backgroundStatus');
    const shuffle=()=>{
        randomOrder=urls.map((_,i)=>i);
        for(let i=randomOrder.length-1;i>0;i--){
            const j=Math.floor(Math.random()*(i+1));
            [randomOrder[i],randomOrder[j]]=[randomOrder[j],randomOrder[i]];
        }
        if(randomOrder.length>1&&randomOrder[0]===Number(layers[currentLayer]?.dataset.index)){
            [randomOrder[0],randomOrder[1]]=[randomOrder[1],randomOrder[0]];
        }
        orderAt=0;
    };
    const slides={
        get count(){return urls.length;},
        showNext(){
            if(!urls.length)return;
            if(orderAt>=randomOrder.length)shuffle();
            const i=randomOrder[orderAt++];
            const next=(currentLayer+1)%2;
            const target=layers[next];
            if(!target)return;
            target.style.backgroundImage='url("'+urls[i]+'")';
            target.dataset.index=String(i);
            target.classList.add('slide-active');
            layers[1-next]?.classList.remove('slide-active');
            currentLayer=next;
        },
        restart(){
            if(timer){clearInterval(timer);timer=null;}
            if(urls.length>1)timer=setInterval(()=>this.showNext(),options.slideSeconds*1000);
        },
        loadUrls(nativeUrls){
            const safe=Array.from(nativeUrls||[]).filter(v=>typeof v==='string' && v.startsWith('https://gaia.local/bg/'));
            if(!safe.length){if(status)status.textContent='선택한 폴더에 사진이 없습니다.';return;}
            this.clear(false); urls=safe.slice(0,450);
            shuffle();this.showNext();this.restart();
            if(status)status.textContent=urls.length+'장 · 기기 폴더 저장됨 · '+options.slideSeconds+'초 간격';
        },
        loadFiles(files){
            const pictures=Array.from(files||[]).filter(f=>
                (f.type&&f.type.startsWith('image/'))||/\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.name||''));
            if(!pictures.length){
                if(status)status.textContent='선택한 곳에 이미지가 없습니다. 사진 여러 장 선택도 가능합니다.';
                return;
            }
            this.clear(false);
            urls=pictures.slice(0,450).map(f=>URL.createObjectURL(f));
            shuffle();this.showNext();this.restart();
            if(status)status.textContent=urls.length+'장 · 무작위 '+options.slideSeconds+'초 전환 · 화면 채우기';
        },
        clear(showMessage=true){
            if(timer)clearInterval(timer);timer=null;
            for(const el of layers){el?.classList.remove('slide-active');}
            for(const url of urls)if(url.startsWith('blob:'))URL.revokeObjectURL(url);
            urls=[];randomOrder=[];orderAt=0;currentLayer=-1;
            if(showMessage&&status)status.textContent='기본 게임 배경 사용 중';
        },
        setInterval(seconds){
            options.slideSeconds=Math.max(4,Math.min(20,Number(seconds)||8));
            persist();this.restart();
            if(urls.length&&status)status.textContent=urls.length+'장 · 무작위 '+options.slideSeconds+'초 전환 · 화면 채우기';
        }
    };
    window.GaiaSlides=slides;
    // Native picker grants durable read access through Android's Storage Access Framework.
    window.GaiaNativeFolder={onFiles(fileUrls){slides.loadUrls(fileUrls);}};
    $('backgroundFolderButton')?.addEventListener('click',()=>{
        if(window.GaiaNativeFiles?.selectFolder)window.GaiaNativeFiles.selectFolder();
        else $('backgroundFolderInput')?.click();
    });
    $('backgroundFilesButton')?.addEventListener('click',()=>$('backgroundFilesInput')?.click());
    $('backgroundFolderInput')?.addEventListener('change',e=>{
        slides.loadFiles(e.target.files);e.target.value='';
    });
    $('backgroundFilesInput')?.addEventListener('change',e=>{
        slides.loadFiles(e.target.files);e.target.value='';
    });
    $('backgroundDefaultButton')?.addEventListener('click',()=>{
        slides.clear();window.GaiaNativeFiles?.clearFolder?.();
    });
    $('slideSeconds')?.addEventListener('input',e=>{
        $('slideSecondsValue').textContent=String(e.target.value)+'초';
        slides.setInterval(e.target.value);
    });
    $('slideSeconds').value=String(options.slideSeconds);
    $('slideSecondsValue').textContent=String(options.slideSeconds)+'초';

    const syncAudio=(which,level)=>{
        $(which+'Value').textContent=Math.round(level*100)+'%';
        if(which==='music')sound?.setMusicLevel(level);
        else sound?.setEffectsLevel(level);
    };
    for(const which of ['music','effects']){
        const el=$(which+'Slider');if(!el)continue;
        el.value=String(Math.round(options[which]*100));
        syncAudio(which,options[which]);
        el.addEventListener('input',e=>syncAudio(which,Number(e.target.value)/100));
    }
    $('vibrationToggle').checked=haptics.enabled;
    $('vibrationToggle')?.addEventListener('change',e=>{
        haptics.enabled=Boolean(e.target.checked);
        options.haptics=haptics.enabled;persist();
    });
    $('vibrationTest')?.addEventListener('click',()=>{
        // Never bypass the setting: previously the test vibrated even when
        // gameplay haptics were disabled, producing a false-positive test.
        if(!haptics.enabled){
            $('vibrationStatus').textContent='진동이 꺼져 있습니다. 진동 사용을 켜 주세요.';
            return;
        }
        const ok=haptics.pulse('explosion',true);
        $('vibrationStatus').textContent=ok?'진동 신호 전송 · 실제 진동은 기기에 따라 다릅니다.':
            '이 브라우저에서 진동 신호가 거부되었습니다. Android Chrome을 확인해 주세요.';
    });
})();
