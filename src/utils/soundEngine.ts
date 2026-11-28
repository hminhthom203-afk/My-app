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
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private audioEl: HTMLAudioElement | null = null;

  private sfxEnabled = true;
  private isPlayingMusic = false;
  private volume = 1;
  private currentTrack: MusicTrack | null = null;
  private stepIndex = 0;
  private loopTimer: number | null = null;
  private lastHoverAt = 0;
  private onTrackEndedCb: (() => void) | null = null;
  private onPlaybackChangeCb: ((playing: boolean) => void) | null = null;
  private mediaControls: MediaControlsCallbacks | null = null;
  private mediaHandlersRegistered = false;
  private playRequestId = 0;
  private chunkObjectUrls = new Map<string, string>();
  private timeListeners = new Set<(currentTime: number, duration: number) => void>();
  private isUsingSilentBridge = false;
  private isInternalTransition = false;
  private silentWavUrl: string | null = null;
  private artworkUrl: string | null = null;
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
    if (this.isUsingSilentBridge) return 0;
    return this.audioEl && !Number.isNaN(this.audioEl.currentTime) ? this.audioEl.currentTime : 0;
  }

  public getDuration(): number {
    if (this.isUsingSilentBridge) return 0;
    return this.audioEl && !Number.isNaN(this.audioEl.duration) ? this.audioEl.duration : 0;
  }

  public seek(seconds: number) {
    if (this.isUsingSilentBridge) return;
    if (this.audioEl && Number.isFinite(seconds)) {
      const maxDur = this.audioEl.duration || 0;
      this.audioEl.currentTime = maxDur > 0 ? Math.max(0, Math.min(maxDur, seconds)) : Math.max(0, seconds);
      this.notifyTimeUpdate();
      this.updateMediaPositionState(true);
    }
  }

  private notifyTimeUpdate() {
    const cur = this.getCurrentTime();
    const dur = this.getDuration();
    this.timeListeners.forEach((cb) => cb(cur, dur));
  }

  private getSilentWavUrl(): string {
    if (this.silentWavUrl) return this.silentWavUrl;
    const sampleRate = 8000;
    const numSamples = sampleRate;
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
    this.silentWavUrl = URL.createObjectURL(blob);
    return this.silentWavUrl;
  }

  private getCandyArtworkUrl(): string {
    if (this.artworkUrl) return this.artworkUrl;
    if (typeof document === 'undefined') return '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      const grad = ctx.createLinearGradient(0, 0, 512, 512);
      grad.addColorStop(0, '#FFF0F5');
      grad.addColorStop(0.5, '#FBCFE8');
      grad.addColorStop(1, '#E2A6BA');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      ctx.beginPath();
      ctx.arc(256, 256, 175, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#B65A7C';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(256, 256, 64, 0, Math.PI * 2);
      ctx.fillStyle = '#6F1F3B';
      ctx.fill();

      ctx.fillStyle = '#FFF0F5';
      ctx.font = 'bold 68px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♪', 256, 260);

      this.artworkUrl = canvas.toDataURL('image/png');
      return this.artworkUrl;
    } catch {
      return '';
    }
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
        // Some browsers do not support certain action types
      }
    };

    setHandler('play', () => {
      if (this.mediaControls) {
        this.mediaControls.onPlay();
      } else if (this.currentTrack) {
        this.resumeOrPlayTrack(this.currentTrack);
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
      if (this.isUsingSilentBridge) return;
      if (typeof details.seekTime === 'number') {
        this.seek(details.seekTime);
      }
    });

    setHandler('seekbackward', (details) => {
      if (this.isUsingSilentBridge) return;
      this.seek(this.getCurrentTime() - (details.seekOffset || 10));
    });

    setHandler('seekforward', (details) => {
      if (this.isUsingSilentBridge) return;
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
          ? [{ src: artworkSrc, sizes: '512x512', type: 'image/png' }]
          : [],
      });
      session.playbackState = playing ? 'playing' : 'paused';
    } catch {
      // ignore MediaMetadata errors on unsupported browsers
    }

    this.updateMediaPositionState(true);
  }

  private updateMediaPositionState(force = false) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    if (typeof session.setPositionState !== 'function') return;

    if (this.isUsingSilentBridge || !this.audioEl) {
      try {
        session.setPositionState(undefined);
      } catch {
        // ignore
      }
      return;
    }

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
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.volume;
      this.musicGain.connect(this.masterGain);

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
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
    if (this.audioEl && !this.isUsingSilentBridge) {
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
    delay = 0,
    target: 'sfx' | 'music' = 'sfx'
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (target === 'sfx' && !this.sfxEnabled) return;

    const dest = target === 'sfx' ? this.sfxGain : this.musicGain;
    if (!dest) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(peak, now + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(env);
    env.connect(dest);

    osc.start(now);
    osc.stop(now + duration + 0.04);
  }

  public playChime() {
    this.playTone(880, 0.22, 'sine', 0.16, 0, 'sfx');
    this.playTone(1318.5, 0.28, 'triangle', 0.1, 0.04, 'sfx');
  }

  public playHoverTick() {
    const now = performance.now();
    if (now - this.lastHoverAt < 140) return;
    this.lastHoverAt = now;
    this.playTone(1046.5, 0.12, 'sine', 0.06, 0, 'sfx');
  }

  public playHeartPop() {
    this.playTone(659.25, 0.14, 'sine', 0.18, 0, 'sfx');
    this.playTone(987.77, 0.18, 'sine', 0.16, 0.06, 'sfx');
    this.playTone(1318.5, 0.26, 'triangle', 0.12, 0.12, 'sfx');
  }

  public playSparkle() {
    const notes = [659.25, 783.99, 987.77, 1174.66, 1318.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.35, 'sine', 0.12, idx * 0.055, 'sfx');
    });
  }

  public playPageTurn() {
    this.playTone(587.33, 0.18, 'sine', 0.12, 0, 'sfx');
    this.playTone(880, 0.24, 'sine', 0.1, 0.05, 'sfx');
  }

  public playSuccess() {
    this.playTone(523.25, 0.18, 'triangle', 0.15, 0, 'sfx');
    this.playTone(783.99, 0.32, 'sine', 0.18, 0.08, 'sfx');
  }

  private stopLoopOnly() {
    if (this.loopTimer !== null) {
      window.clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.audioEl) {
      this.isInternalTransition = true;
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } finally {
        this.isInternalTransition = false;
      }
    }
    this.isUsingSilentBridge = false;
  }

  private ensureAudioEl(): HTMLAudioElement {
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.setAttribute('playsinline', 'true');
      this.audioEl.preload = 'auto';

      this.audioEl.addEventListener('timeupdate', () => {
        if (this.isUsingSilentBridge) return;
        this.notifyTimeUpdate();
        this.updateMediaPositionState(false);
      });

      this.audioEl.addEventListener('durationchange', () => {
        this.notifyTimeUpdate();
        this.updateMediaPositionState(true);
      });

      this.audioEl.addEventListener('seeked', () => {
        if (!this.isUsingSilentBridge) {
          this.updateMediaPositionState(true);
        }
      });

      this.audioEl.addEventListener('pause', () => {
        if (this.isInternalTransition) return;
        if (this.isPlayingMusic && this.audioEl && !this.audioEl.ended) {
          this.isPlayingMusic = false;
          if (this.loopTimer !== null) {
            window.clearInterval(this.loopTimer);
            this.loopTimer = null;
          }
          this.syncMediaSession(this.currentTrack, false);
          this.onPlaybackChangeCb?.(false);
        }
      });

      this.audioEl.addEventListener('play', () => {
        if (this.isInternalTransition) return;
        if (!this.isPlayingMusic && this.currentTrack) {
          this.isPlayingMusic = true;
          if (this.isUsingSilentBridge && this.loopTimer === null) {
            this.startSynthLoopOnly(this.currentTrack.synthPreset || 'rose_waltz');
          }
          this.syncMediaSession(this.currentTrack, true);
          this.onPlaybackChangeCb?.(true);
        }
      });

      this.audioEl.addEventListener('ended', () => {
        if (this.isUsingSilentBridge) return;
        this.notifyTimeUpdate();
        if (this.onTrackEndedCb) {
          this.onTrackEndedCb();
        } else if (this.audioEl && this.isPlayingMusic) {
          this.audioEl.currentTime = 0;
          void this.audioEl.play().catch(() => {});
        }
      });
    }
    return this.audioEl;
  }

  private async resolveChunkedTrackUrl(track: MusicTrack): Promise<string> {
    const cacheKey = `${track.id}|${track.audioUrl}`;
    const existing = this.chunkObjectUrls.get(cacheKey);
    if (existing) return existing;

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
  }

  public playTrack(track: MusicTrack) {
    this.ensureContext();
    this.stopLoopOnly();
    this.currentTrack = track;
    this.isPlayingMusic = true;
    this.stepIndex = 0;
    const reqId = ++this.playRequestId;
    this.syncMediaSession(track, true);

    const rawUrl = (track.audioUrl || '').trim();
    if (rawUrl.length > 0) {
      if (rawUrl.startsWith('chunks:')) {
        void this.resolveChunkedTrackUrl(track)
          .then((objectUrl) => {
            if (reqId !== this.playRequestId || !this.isPlayingMusic) return;
            const audio = this.ensureAudioEl();
            this.isInternalTransition = true;
            try {
              this.isUsingSilentBridge = false;
              audio.loop = false;
              audio.src = objectUrl;
              audio.volume = this.volume;
            } finally {
              this.isInternalTransition = false;
            }
            return audio.play().then(() => {
              if (reqId === this.playRequestId && this.isPlayingMusic) {
                this.syncMediaSession(track, true);
              }
            });
          })
          .catch(() => {
            if (reqId === this.playRequestId && this.isPlayingMusic) {
              this.startSynthLoop(track.synthPreset || 'rose_waltz');
            }
          });
        return;
      }

      const audio = this.ensureAudioEl();
      this.isInternalTransition = true;
      try {
        this.isUsingSilentBridge = false;
        audio.loop = false;
        audio.src = normalizeMediaUrl(rawUrl, 'audio');
        audio.volume = this.volume;
      } finally {
        this.isInternalTransition = false;
      }
      audio
        .play()
        .then(() => {
          if (reqId === this.playRequestId && this.isPlayingMusic) {
            this.syncMediaSession(track, true);
          }
        })
        .catch(() => {
          if (reqId === this.playRequestId && this.isPlayingMusic) {
            this.startSynthLoop(track.synthPreset || 'rose_waltz');
          }
        });
      return;
    }

    this.startSynthLoop(track.synthPreset || 'rose_waltz');
  }

  public resumeOrPlayTrack(track: MusicTrack) {
    if (
      this.currentTrack &&
      this.currentTrack.id === track.id &&
      (this.currentTrack.audioUrl || '') === (track.audioUrl || '')
    ) {
      this.ensureContext();
      this.currentTrack = track;
      this.isPlayingMusic = true;
      this.syncMediaSession(track, true);

      if (this.isUsingSilentBridge) {
        this.startSilentBridgeAudio();
        if (this.loopTimer === null) {
          this.startSynthLoopOnly(track.synthPreset || 'rose_waltz');
        }
        return;
      }

      if (this.audioEl && this.audioEl.src) {
        this.audioEl.volume = this.volume;
        this.audioEl
          .play()
          .then(() => {
            if (this.isPlayingMusic) {
              this.syncMediaSession(track, true);
            }
          })
          .catch(() => {
            this.playTrack(track);
          });
        return;
      }
    }
    this.playTrack(track);
  }

  private startSilentBridgeAudio() {
    try {
      const audio = this.ensureAudioEl();
      const wavUrl = this.getSilentWavUrl();
      this.isInternalTransition = true;
      try {
        this.isUsingSilentBridge = true;
        if (audio.src !== wavUrl) {
          audio.src = wavUrl;
        }
        audio.loop = true;
        audio.volume = 1;
      } finally {
        this.isInternalTransition = false;
      }
      this.notifyTimeUpdate();
      this.updateMediaPositionState(true);
      void audio
        .play()
        .then(() => {
          if (this.isPlayingMusic && this.currentTrack) {
            this.syncMediaSession(this.currentTrack, true);
          }
        })
        .catch(() => {});
    } catch {
      // ignore silent bridge errors
    }
  }

  private startSynthLoopOnly(presetKey: SynthPreset) {
    if (this.loopTimer !== null) {
      window.clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    const score = PRESETS[presetKey] || PRESETS.rose_waltz;
    const stepMs = (60 / score.bpm / 2) * 1000;

    const tick = () => {
      if (!this.isPlayingMusic) return;
      const mNote = score.melody[this.stepIndex % score.melody.length];
      const bNote = score.bass[this.stepIndex % score.bass.length];

      if (mNote > 0) {
        this.playTone(midiToFreq(mNote), 0.72, score.waveform, 0.18, 0, 'music');
        // delicate overtone shimmer
        this.playTone(midiToFreq(mNote + 12), 0.35, 'sine', 0.04, 0.01, 'music');
      }
      if (bNote > 0 && this.stepIndex % 2 === 0) {
        this.playTone(midiToFreq(bNote), 1.1, 'sine', 0.11, 0, 'music');
      }

      this.stepIndex = (this.stepIndex + 1) % score.melody.length;
    };

    tick();
    this.loopTimer = window.setInterval(tick, stepMs);
  }

  private startSynthLoop(presetKey: SynthPreset) {
    this.startSilentBridgeAudio();
    this.startSynthLoopOnly(presetKey);
  }

  public pauseMusic() {
    this.isPlayingMusic = false;
    if (this.loopTimer !== null) {
      window.clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
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
    this.isPlayingMusic = false;
    this.stopLoopOnly();
    this.syncMediaSession(null, false);
  }

  public resumeMusic(fallbackTrack?: MusicTrack) {
    if (this.currentTrack) {
      this.resumeOrPlayTrack(this.currentTrack);
    } else if (fallbackTrack) {
      this.playTrack(fallbackTrack);
    }
  }

  public isPlaying() {
    return this.isPlayingMusic;
  }
}

export const soundEngine = new SoundEngine();
