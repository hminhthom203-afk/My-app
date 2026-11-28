import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { MusicTrack } from '../types';
import { base64ToUint8Array, normalizeMediaUrl } from './mediaHelpers';

type SynthPreset = NonNullable<MusicTrack['synthPreset']>;

interface PresetScore {
  bpm: number;
  melody: number[]; // MIDI note numbers, 0 = rest
  bass: number[];
  waveform: OscillatorType;
}

const PRESETS: Record<SynthPreset, PresetScore> = {
  rose_waltz: {
    bpm: 92,
    waveform: 'sine',
    melody: [
      76, 79, 83, 84, 83, 79, 76, 79,
      74, 78, 81, 83, 81, 78, 74, 0,
      72, 76, 79, 83, 81, 79, 76, 74,
      76, 79, 81, 79, 76, 74, 72, 0,
    ],
    bass: [
      57, 64, 69, 64, 57, 64, 69, 64,
      55, 62, 67, 62, 55, 62, 67, 62,
      53, 60, 65, 60, 53, 60, 65, 60,
      52, 59, 64, 59, 52, 59, 64, 59,
    ],
  },
  cotton_lullaby: {
    bpm: 78,
    waveform: 'triangle',
    melody: [
      72, 76, 79, 84, 83, 79, 76, 0,
      74, 77, 81, 84, 81, 79, 77, 0,
      76, 79, 83, 86, 84, 83, 79, 76,
      74, 76, 79, 76, 72, 0, 72, 0,
    ],
    bass: [
      48, 55, 60, 55, 48, 55, 60, 55,
      50, 57, 62, 57, 50, 57, 62, 57,
      52, 59, 64, 59, 52, 59, 64, 59,
      48, 55, 60, 55, 48, 55, 60, 55,
    ],
  },
  velvet_nocturne: {
    bpm: 72,
    waveform: 'sine',
    melody: [
      69, 72, 76, 79, 76, 74, 72, 0,
      67, 71, 74, 79, 76, 74, 71, 0,
      65, 69, 72, 76, 74, 72, 69, 0,
      64, 69, 72, 71, 69, 0, 69, 0,
    ],
    bass: [
      45, 52, 57, 60, 45, 52, 57, 60,
      43, 50, 55, 59, 43, 50, 55, 59,
      41, 48, 53, 57, 41, 48, 53, 57,
      40, 47, 52, 55, 45, 52, 57, 52,
    ],
  },
  petal_breeze: {
    bpm: 96,
    waveform: 'sine',
    melody: [
      79, 81, 83, 86, 83, 81, 79, 76,
      74, 76, 79, 81, 79, 76, 74, 0,
      76, 79, 81, 83, 86, 83, 81, 79,
      76, 74, 72, 74, 76, 79, 76, 0,
    ],
    bass: [
      55, 62, 67, 62, 55, 62, 67, 62,
      50, 57, 62, 57, 50, 57, 62, 57,
      52, 59, 64, 59, 52, 59, 64, 59,
      48, 55, 60, 55, 48, 55, 60, 55,
    ],
  },
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface MediaControlsCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onStop: () => void;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private audioEl: HTMLAudioElement | null = null;

  private sfxEnabled = true;
  private isPlayingMusic = false;
  private volume = 1;
  private currentTrack: MusicTrack | null = null;
  private lastHoverAt = 0;
  private onTrackEndedCb: (() => void) | null = null;
  private onPlaybackChangeCb: ((playing: boolean) => void) | null = null;
  private mediaControls: MediaControlsCallbacks | null = null;
  private mediaHandlersRegistered = false;
  private playRequestId = 0;
  private activeTrackAttempt: { key: string; gestured: boolean } | null = null;
  private chunkObjectUrls = new Map<string, string>();
  private chunkPrefetchPromises = new Map<string, Promise<string>>();
  private synthWavUrls = new Map<SynthPreset, string>();
  private timeListeners = new Set<(currentTime: number, duration: number) => void>();
  private isUsingSynthLoop = false;
  private isInternalTransition = false;
  private isPrimed = false;
  private tinySilentWavUrl: string | null = null;
  private lastPositionSyncAt = 0;

  public setOnTrackEnded(cb: (() => void) | null) {
    this.onTrackEndedCb = cb;
  }

  public setOnPlaybackChange(cb: ((playing: boolean) => void) | null) {
    this.onPlaybackChangeCb = cb;
  }

  public setMediaControls(callbacks: MediaControlsCallbacks | null) {
    this.mediaControls = callbacks;
    this.registerMediaActionHandlers();
  }

  public onTimeUpdate(cb: (currentTime: number, duration: number) => void): () => void {
    this.timeListeners.add(cb);
    cb(this.getCurrentTime(), this.getDuration());
    return () => {
      this.timeListeners.delete(cb);
    };
  }

  public getCurrentTime(): number {
    return this.audioEl && !Number.isNaN(this.audioEl.currentTime) ? this.audioEl.currentTime : 0;
  }

  public getDuration(): number {
    return this.audioEl && !Number.isNaN(this.audioEl.duration) ? this.audioEl.duration : 0;
  }

  public seek(seconds: number) {
    if (this.audioEl && Number.isFinite(seconds)) {
      const maxDur = this.audioEl.duration || 0;
      this.audioEl.currentTime =
        maxDur > 0 ? Math.max(0, Math.min(maxDur, seconds)) : Math.max(0, seconds);
      this.notifyTimeUpdate();
      this.updateMediaPositionState(true);
    }
  }

  private notifyTimeUpdate() {
    const cur = this.getCurrentTime();
    const dur = this.getDuration();
    this.timeListeners.forEach((cb) => cb(cur, dur));
  }

  private getTinySilentWavUrl(): string {
    if (this.tinySilentWavUrl) return this.tinySilentWavUrl;
    const sampleRate = 8000;
    const numSamples = 800; // 0.1s
    const buffer = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buffer);
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples, true);
    new Uint8Array(buffer, 44).fill(128);
    const blob = new Blob([buffer], { type: 'audio/wav' });
    this.tinySilentWavUrl = URL.createObjectURL(blob);
    return this.tinySilentWavUrl;
  }

  private getSynthWavUrl(presetKey: SynthPreset): string {
    const cached = this.synthWavUrls.get(presetKey);
    if (cached) return cached;

    const score = PRESETS[presetKey] || PRESETS.rose_waltz;
    const sampleRate = 22050;
    const stepSec = 60 / score.bpm / 2;
    const totalSteps = score.melody.length;
    const totalSamples = Math.max(1, Math.floor(totalSteps * stepSec * sampleRate));
    const mix = new Float32Array(totalSamples);

    const addNote = (
      startSec: number,
      durationSec: number,
      freq: number,
      peak: number,
      waveform: OscillatorType
    ) => {
      const startSample = Math.floor(startSec * sampleRate);
      const lenSamples = Math.floor(durationSec * sampleRate);
      const attackSamples = Math.max(1, Math.floor(0.02 * sampleRate));

      for (let i = 0; i < lenSamples; i++) {
        const idx = (startSample + i) % totalSamples;
        const t = i / sampleRate;
        const envAttack = i < attackSamples ? i / attackSamples : 1;
        const envDecay = Math.exp(-3.8 * (i / lenSamples));
        const env = envAttack * envDecay;
        const phase = 2 * Math.PI * freq * t;
        let sample = Math.sin(phase);
        if (waveform === 'triangle') {
          sample = (2 / Math.PI) * Math.asin(Math.sin(phase));
        }
        mix[idx] += sample * peak * env;
      }
    };

    for (let step = 0; step < totalSteps; step++) {
      const startSec = step * stepSec;
      const mNote = score.melody[step % score.melody.length];
      const bNote = score.bass[step % score.bass.length];

      if (mNote > 0) {
        addNote(startSec, 0.72, midiToFreq(mNote), 0.24, score.waveform);
        addNote(startSec + 0.01, 0.35, midiToFreq(mNote + 12), 0.055, 'sine');
      }
      if (bNote > 0 && step % 2 === 0) {
        addNote(startSec, 1.05, midiToFreq(bNote), 0.14, 'sine');
      }
    }

    // Smooth fade-in/out over 4ms at loop seam to prevent clicks
    const fadeSamples = Math.min(Math.floor(0.004 * sampleRate), Math.floor(totalSamples / 4));
    for (let i = 0; i < fadeSamples; i++) {
      const k = i / fadeSamples;
      mix[i] *= k;
      mix[totalSamples - 1 - i] *= k;
    }

    const buffer = new ArrayBuffer(44 + totalSamples * 2);
    const view = new DataView(buffer);
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + totalSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, totalSamples * 2, true);

    for (let i = 0; i < totalSamples; i++) {
      const clamped = Math.max(-0.95, Math.min(0.95, mix[i]));
      view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    this.synthWavUrls.set(presetKey, url);
    return url;
  }

  private getCandyArtworkUrl(): string {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/assets/aistudio/b3d0d8ea8ac20daa182418f5c4ed3de2_3adce6a1.jpg`;
  }

  private registerMediaActionHandlers() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (this.mediaHandlersRegistered) return;
    this.mediaHandlersRegistered = true;

    const session = navigator.mediaSession;
    const setHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null
    ) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Unsupported action in this browser
      }
    };

    setHandler('play', () => {
      if (this.mediaControls) {
        this.mediaControls.onPlay();
      } else if (this.currentTrack) {
        void this.resumeOrPlayTrack(this.currentTrack);
        this.onPlaybackChangeCb?.(true);
      }
    });

    setHandler('pause', () => {
      if (this.mediaControls) {
        this.mediaControls.onPause();
      } else {
        this.pauseMusic();
        this.onPlaybackChangeCb?.(false);
      }
    });

    setHandler('stop', () => {
      if (this.mediaControls) {
        this.mediaControls.onStop();
      } else {
        this.stopMusic();
        this.onPlaybackChangeCb?.(false);
      }
    });

    setHandler('nexttrack', () => {
      this.mediaControls?.onNext();
    });

    setHandler('previoustrack', () => {
      this.mediaControls?.onPrev();
    });

    setHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') {
        this.seek(details.seekTime);
      }
    });

    setHandler('seekbackward', (details) => {
      this.seek(this.getCurrentTime() - (details.seekOffset || 10));
    });

    setHandler('seekforward', (details) => {
      this.seek(this.getCurrentTime() + (details.seekOffset || 10));
    });
  }

  public syncMediaSession(track: MusicTrack | null, playing: boolean) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    this.registerMediaActionHandlers();

    if (!track) {
      try {
        session.metadata = null;
        session.playbackState = 'none';
      } catch {
        // ignore
      }
      return;
    }

    try {
      const artworkSrc = this.getCandyArtworkUrl();
      session.metadata = new MediaMetadata({
        title: track.title || 'Nhạc nền Ăn Kẹo Hong',
        artist: (track.artist || '').trim() || 'Ăn Kẹo Hong',
        album: 'Hộp Nhạc Ăn Kẹo Hong',
        artwork: artworkSrc
          ? [{ src: artworkSrc, sizes: '512x512', type: 'image/jpeg' }]
          : [],
      });
      session.playbackState = playing ? 'playing' : 'paused';
    } catch {
      // ignore MediaMetadata errors
    }

    this.updateMediaPositionState(true);
  }

  private updateMediaPositionState(force = false) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    if (typeof session.setPositionState !== 'function' || !this.audioEl) return;

    const now = performance.now();
    if (!force && now - this.lastPositionSyncAt < 900) return;
    this.lastPositionSyncAt = now;

    const duration = this.audioEl.duration;
    const position = this.audioEl.currentTime;
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return;

    try {
      session.setPositionState({
        duration,
        playbackRate: this.audioEl.playbackRate || 1,
        position: Math.max(0, Math.min(duration, position)),
      });
    } catch {
      // ignore invalid position state
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxEnabled ? 0.35 : 0;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
    this.ensureAudioEl();
  }

  public primeOnUserGesture() {
    this.ensureContext();
    const audio = this.ensureAudioEl();
    if (this.isPrimed || this.isPlayingMusic) return;
    try {
      this.isInternalTransition = true;
      audio.src = this.getTinySilentWavUrl();
      audio.loop = false;
      audio.volume = 0.01;
      void audio
        .play()
        .then(() => {
          this.isPrimed = true;
        })
        .catch(() => {})
        .finally(() => {
          this.isInternalTransition = false;
        });
    } catch {
      this.isInternalTransition = false;
    }
  }

  public setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(enabled ? 0.35 : 0, this.ctx.currentTime, 0.04);
    }
  }

  public getSfxEnabled() {
    return this.sfxEnabled;
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.audioEl) {
      this.audioEl.volume = this.volume;
    }
  }

  public getVolume() {
    return this.volume;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    peak = 0.2,
    delay = 0
  ) {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(peak, now + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(env);
    env.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + duration + 0.04);
  }

  public playChime() {
    this.playTone(880, 0.22, 'sine', 0.16, 0);
    this.playTone(1318.5, 0.28, 'triangle', 0.1, 0.04);
  }

  public playHoverTick() {
    const now = performance.now();
    if (now - this.lastHoverAt < 140) return;
    this.lastHoverAt = now;
    this.playTone(1046.5, 0.12, 'sine', 0.06, 0);
  }

  public playHeartPop() {
    this.playTone(659.25, 0.14, 'sine', 0.18, 0);
    this.playTone(987.77, 0.18, 'sine', 0.16, 0.06);
    this.playTone(1318.5, 0.26, 'triangle', 0.12, 0.12);
  }

  public playSparkle() {
    const notes = [659.25, 783.99, 987.77, 1174.66, 1318.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.35, 'sine', 0.12, idx * 0.055);
    });
  }

  public playPageTurn() {
    this.playTone(587.33, 0.18, 'sine', 0.12, 0);
    this.playTone(880, 0.24, 'sine', 0.1, 0.05);
  }

  public playSuccess() {
    this.playTone(523.25, 0.18, 'triangle', 0.15, 0);
    this.playTone(783.99, 0.32, 'sine', 0.18, 0.08);
  }

  private stopAudioOnly() {
    if (this.audioEl) {
      this.isInternalTransition = true;
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } finally {
        this.isInternalTransition = false;
      }
    }
    this.isUsingSynthLoop = false;
  }

  private ensureAudioEl(): HTMLAudioElement {
    if (!this.audioEl) {
      this.audioEl = document.createElement('audio');
      this.audioEl.setAttribute('playsinline', 'true');
      this.audioEl.setAttribute('webkit-playsinline', 'true');
      this.audioEl.setAttribute('aria-hidden', 'true');
      this.audioEl.preload = 'auto';
      this.audioEl.style.display = 'none';

      this.audioEl.addEventListener('timeupdate', () => {
        this.notifyTimeUpdate();
        this.updateMediaPositionState(false);
      });

      this.audioEl.addEventListener('durationchange', () => {
        this.notifyTimeUpdate();
        this.updateMediaPositionState(true);
      });

      this.audioEl.addEventListener('seeked', () => {
        this.updateMediaPositionState(true);
      });

      this.audioEl.addEventListener('pause', () => {
        if (this.isInternalTransition) return;
        if (this.isPlayingMusic && this.audioEl && !this.audioEl.ended) {
          this.isPlayingMusic = false;
          this.syncMediaSession(this.currentTrack, false);
          this.onPlaybackChangeCb?.(false);
        }
      });

      this.audioEl.addEventListener('play', () => {
        this.isPrimed = true;
        if (this.isInternalTransition) return;
        if (!this.isPlayingMusic && this.currentTrack) {
          this.isPlayingMusic = true;
          this.syncMediaSession(this.currentTrack, true);
          this.onPlaybackChangeCb?.(true);
        }
      });

      this.audioEl.addEventListener('ended', () => {
        if (this.isUsingSynthLoop) return;
        this.notifyTimeUpdate();
        if (this.onTrackEndedCb) {
          this.onTrackEndedCb();
        } else if (this.audioEl && this.isPlayingMusic) {
          this.audioEl.currentTime = 0;
          void this.audioEl.play().catch(() => {});
        }
      });
    }

    if (typeof document !== 'undefined' && document.body && !this.audioEl.isConnected) {
      document.body.appendChild(this.audioEl);
    }

    return this.audioEl;
  }

  private async resolveChunkedTrackUrl(track: MusicTrack): Promise<string> {
    const cacheKey = `${track.id}|${track.audioUrl}`;
    const existing = this.chunkObjectUrls.get(cacheKey);
    if (existing) return existing;

    const pending = this.chunkPrefetchPromises.get(cacheKey);
    if (pending) return pending;

    const promise = (async () => {
      const parts = track.audioUrl.split(':');
      const mimeType = parts.slice(2).join(':') || 'audio/mpeg';
      const snap = await getDocs(collection(db, 'tracks', track.id, 'chunks'));
      const sorted = snap.docs
        .map((d) => d.data() as { index?: number; data?: string; mimeType?: string })
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

      if (sorted.length === 0) {
        throw new Error('Không tìm thấy dữ liệu âm thanh của bài hát.');
      }

      const byteArrays: Uint8Array<ArrayBuffer>[] = sorted
        .filter((c) => typeof c.data === 'string' && c.data.length > 0)
        .map((c) => new Uint8Array(base64ToUint8Array(c.data!)));

      const resolvedMime = sorted[0]?.mimeType || mimeType;
      const blob = new Blob(byteArrays, { type: resolvedMime });
      const objectUrl = URL.createObjectURL(blob);
      this.chunkObjectUrls.set(cacheKey, objectUrl);
      return objectUrl;
    })();

    this.chunkPrefetchPromises.set(cacheKey, promise);
    try {
      return await promise;
    } catch (err) {
      this.chunkPrefetchPromises.delete(cacheKey);
      throw err;
    }
  }

  public preloadTrack(track: MusicTrack) {
    if (!track) return;
    const rawUrl = (track.audioUrl || '').trim();
    if (rawUrl.startsWith('chunks:')) {
      void this.resolveChunkedTrackUrl(track).catch(() => {});
    } else if (!rawUrl) {
      this.getSynthWavUrl(track.synthPreset || 'rose_waltz');
    }
  }

  private async startAudioSrc(
    srcUrl: string,
    loop: boolean,
    isSynth: boolean,
    track: MusicTrack,
    reqId: number
  ): Promise<'playing' | 'blocked' | 'error'> {
    if (reqId !== this.playRequestId) return 'error';
    const audio = this.ensureAudioEl();
    this.isInternalTransition = true;
    try {
      this.isUsingSynthLoop = isSynth;
      audio.loop = loop;
      if (audio.src !== srcUrl) {
        audio.src = srcUrl;
      }
      audio.volume = this.volume;
    } finally {
      this.isInternalTransition = false;
    }

    try {
      await audio.play();
      if (reqId !== this.playRequestId) return 'error';
      this.isPrimed = true;
      this.isPlayingMusic = true;
      this.syncMediaSession(track, true);
      this.onPlaybackChangeCb?.(true);
      return 'playing';
    } catch (err) {
      const errName = (err as { name?: string })?.name || '';
      if (errName === 'NotAllowedError') {
        this.isPlayingMusic = false;
        this.onPlaybackChangeCb?.(false);
        return 'blocked';
      }
      if (errName === 'AbortError') {
        return 'error';
      }
      return 'error';
    }
  }

  public async playTrack(
    track: MusicTrack,
    fromGesture = false
  ): Promise<'playing' | 'blocked' | 'error'> {
    const attemptKey = `${track.id}|${track.audioUrl}`;
    if (
      this.activeTrackAttempt &&
      this.activeTrackAttempt.key === attemptKey &&
      this.activeTrackAttempt.gestured
    ) {
      return this.isPlayingMusic ? 'playing' : 'error';
    }

    this.ensureContext();
    this.stopAudioOnly();
    this.currentTrack = track;
    const reqId = ++this.playRequestId;
    this.activeTrackAttempt = { key: attemptKey, gestured: fromGesture };

    try {
      const rawUrl = (track.audioUrl || '').trim();
      if (rawUrl.length > 0) {
        if (rawUrl.startsWith('chunks:')) {
          const cachedUrl = this.chunkObjectUrls.get(attemptKey);
          if (cachedUrl) {
            const result = await this.startAudioSrc(cachedUrl, false, false, track, reqId);
            if (result !== 'error') return result;
          } else {
            if (fromGesture && !this.isPrimed) {
              this.primeOnUserGesture();
            }
            try {
              const objectUrl = await this.resolveChunkedTrackUrl(track);
              if (reqId !== this.playRequestId) return 'error';
              const result = await this.startAudioSrc(objectUrl, false, false, track, reqId);
              if (result !== 'error') return result;
            } catch {
              // Fall through to synthesized WAV fallback
            }
          }
        } else {
          const directUrl = normalizeMediaUrl(rawUrl, 'audio');
          const result = await this.startAudioSrc(directUrl, false, false, track, reqId);
          if (result !== 'error') return result;
        }
      }

      const synthUrl = this.getSynthWavUrl(track.synthPreset || 'rose_waltz');
      return await this.startAudioSrc(synthUrl, true, true, track, reqId);
    } finally {
      if (reqId === this.playRequestId) {
        this.activeTrackAttempt = null;
      }
    }
  }

  public async resumeOrPlayTrack(track: MusicTrack): Promise<'playing' | 'blocked' | 'error'> {
    if (
      this.currentTrack &&
      this.currentTrack.id === track.id &&
      (this.currentTrack.audioUrl || '') === (track.audioUrl || '') &&
      this.audioEl &&
      this.audioEl.src &&
      this.audioEl.src !== this.tinySilentWavUrl
    ) {
      this.ensureContext();
      this.currentTrack = track;
      const reqId = ++this.playRequestId;
      this.audioEl.volume = this.volume;
      try {
        await this.audioEl.play();
        if (reqId !== this.playRequestId) return 'error';
        this.isPrimed = true;
        this.isPlayingMusic = true;
        this.syncMediaSession(track, true);
        this.onPlaybackChangeCb?.(true);
        return 'playing';
      } catch (err) {
        const errName = (err as { name?: string })?.name || '';
        if (errName === 'NotAllowedError') {
          this.isPlayingMusic = false;
          this.onPlaybackChangeCb?.(false);
          return 'blocked';
        }
      }
    }
    return this.playTrack(track);
  }

  public pauseMusic() {
    this.playRequestId++;
    this.isPlayingMusic = false;
    if (this.audioEl) {
      this.isInternalTransition = true;
      try {
        this.audioEl.pause();
      } finally {
        this.isInternalTransition = false;
      }
    }
    this.syncMediaSession(this.currentTrack, false);
  }

  public stopMusic() {
    this.playRequestId++;
    this.isPlayingMusic = false;
    this.stopAudioOnly();
    this.syncMediaSession(null, false);
  }

  public resumeMusic(fallbackTrack?: MusicTrack) {
    if (this.currentTrack) {
      void this.resumeOrPlayTrack(this.currentTrack);
    } else if (fallbackTrack) {
      void this.playTrack(fallbackTrack);
    }
  }

  public isPlaying() {
    return this.isPlayingMusic;
  }
}

export const soundEngine = new SoundEngine();
