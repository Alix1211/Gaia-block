// GAIA HEART BREAKER — offline audio (user-supplied BGM and reaction clips).
// Cached short MP3 clips avoid decoding a minute-long WAV at each brick hit.
window.GaiaSound = {
    enabled: true,
    ctx: null,
    initialized: false,
    shouldPlay: false,
    paused: false,
    music: null,
    oldMusic: null,
    currentBpm: null,
    fadeTimer: null,
    duckTimer: null,
    lastSlapAt: -Infinity,
    lastVoiceAt: -Infinity,
    slapCount: 0,
    samples: {},
    musicVolume: 0.27,

    url(name) {
        const path = `assets/audio/${name}.mp3`;
        return window.GaiaAssetUrl ? window.GaiaAssetUrl(path) : path;
    },
    makeAudio(name, volume) {
        if (typeof Audio === 'undefined') return null;
        const clip = new Audio(this.url(name));
        clip.preload = 'auto';
        clip.volume = volume;
        return clip;
    },
    init() {
        if (this.initialized || typeof Audio === 'undefined') return;
        this.initialized = true;
        for (const name of [
            'slap-1', 'slap-2', 'slap-3',
            'voice-surprise', 'voice-effort', 'voice-yelp',
            'voice-whimper', 'voice-happy', 'voice-sigh', 'voice-home-run'
        ]) {
            this.samples[name] = this.makeAudio(name, name.startsWith('slap-') ? 0.69 : 0.87);
        }
    },
    safePlay(clip) {
        if (!clip) return;
        try { clip.play()?.catch?.(() => {}); } catch (_) { /* Audio is optional. */ }
    },
    stopFade() {
        if (this.fadeTimer !== null) clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        if (this.oldMusic) this.oldMusic.pause();
        this.oldMusic = null;
    },
    bpmForStage(stageIndex) {
        return stageIndex < 2 ? 90 : stageIndex < 5 ? 120 : 150;
    },
    start(stageIndex = 0) {
        this.init();
        this.shouldPlay = true;
        this.paused = false;
        const before = this.currentBpm;
        this.setStage(stageIndex);
        if (before === this.currentBpm) this.resume();
    },
    setStage(stageIndex) {
        const bpm = this.bpmForStage(stageIndex);
        if (this.currentBpm === bpm && this.music) return;
        this.stopFade();
        const previous = this.music;
        const next = this.makeAudio(`bgm-${bpm}`, 0);
        this.currentBpm = bpm;
        if (!next) return;
        this.music = next;
        next.loop = true;
        if (!this.enabled || !this.shouldPlay || this.paused) {
            if (previous) previous.pause();
            next.volume = this.musicVolume;
            return;
        }
        this.safePlay(next);
        this.oldMusic = previous;
        const started = Date.now();
        this.fadeTimer = setInterval(() => {
            const t = Math.min(1, (Date.now() - started) / 700);
            if (this.oldMusic) this.oldMusic.volume = this.musicVolume * (1 - t);
            next.volume = this.musicVolume * t;
            if (t >= 1) this.stopFade();
        }, 50);
    },
    pause() {
        this.paused = true;
        this.stopFade();
        if (this.music) this.music.pause();
    },
    resume() {
        this.paused = false;
        if (!this.shouldPlay || !this.enabled || !this.music) return;
        this.music.volume = this.musicVolume;
        this.safePlay(this.music);
    },
    stop() {
        this.shouldPlay = false;
        this.pause();
        if (this.music) {
            try { this.music.currentTime = 0; } catch (_) { /* optional */ }
        }
        this.music = null;
        this.currentBpm = null;
        this.paused = false;
        clearTimeout(this.duckTimer);
        this.duckTimer = null;
    },
    setEnabled(next) {
        this.enabled = Boolean(next);
        if (!this.enabled) {
            this.stopFade();
            if (this.music) this.music.pause();
            for (const clip of Object.values(this.samples)) clip?.pause();
        } else if (!this.paused) {
            this.resume();
        }
    },
    effect(name) {
        if (!this.enabled) return;
        this.init();
        const clip = this.samples[name];
        if (!clip) return;
        try { clip.currentTime = 0; } catch (_) { /* File browsers differ. */ }
        this.safePlay(clip);
    },
    brick(hits = 1) {
        if (!this.enabled) return;
        const now = Date.now();
        if (now - this.lastSlapAt < 85) return; // Avoid dozens of overlapping clips on one explosion.
        this.lastSlapAt = now;
        const sample = hits > 1 ? (this.slapCount % 2 ? 'slap-2' : 'slap-3')
                               : `slap-${(this.slapCount % 3) + 1}`;
        this.slapCount++;
        this.effect(sample);
    },
    voice(kind = 'surprise', forced = false) {
        if (!this.enabled) return;
        const now = Date.now();
        if (!forced && now - this.lastVoiceAt < 1800) return;
        this.lastVoiceAt = now;
        this.effect(`voice-${kind}`);
        if (this.music) {
            this.music.volume = this.musicVolume * 0.43;
            clearTimeout(this.duckTimer);
            this.duckTimer = setTimeout(() => {
                if (this.music && this.enabled && this.shouldPlay) this.music.volume = this.musicVolume;
            }, kind === 'happy' ? 1300 : 950);
        }
    },
    // The paddle/items keep their quiet synth sounds. Bricks never use glass-breaking beeps.
    play(freq, wave, duration, gainLevel, endFreq) {
        if (!this.enabled) return;
        try {
            if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = wave;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
            gain.gain.setValueAtTime(gainLevel, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (_) { /* Audio is optional in offline browsers. */ }
    },
    paddle() { this.play(300, 'sine', 0.07, 0.045, 180); },
    powerUp() { this.play(450, 'sine', 0.18, 0.065, 950); },
    lose() { this.play(190, 'sawtooth', 0.27, 0.045, 70); this.voice('sigh'); },
    levelUp() { this.play(530, 'sine', 0.25, 0.055, 980); }
};
