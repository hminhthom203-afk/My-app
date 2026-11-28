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
  private playRequestId = 0;
  private chunkObjectUrls = new Map<string, string>();
  private timeListeners = new Set<(currentTime: number, duration: number) => void>();

  public setOnTrackEnded(cb: (() => void) | null) {
    this.onTrackEndedCb = cb;
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
      this.audioEl.currentTime = maxDur > 0 ? Math.max(0, Math.min(maxDur, seconds)) : Math.max(0, seconds);
      this.notifyTimeUpdate();
    }
  }

  private notifyTimeUpdate() {
    const cur = this.getCurrentTime();
    const dur = this.getDuration();
    this.timeListeners.forEach((cb) => cb(cur, dur));
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
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    }
  }

  private ensureAudioEl(): HTMLAudioElement {
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.addEventListener('timeupdate', () => {
        this.notifyTimeUpdate();
      });
      this.audioEl.addEventListener('durationchange', () => {
        this.notifyTimeUpdate();
      });
      this.audioEl.addEventListener('ended', () => {
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

    const rawUrl = (track.audioUrl || '').trim();
    if (rawUrl.length > 0) {
      if (rawUrl.startsWith('chunks:')) {
        void this.resolveChunkedTrackUrl(track)
          .then((objectUrl) => {
            if (reqId !== this.playRequestId || !this.isPlayingMusic) return;
            const audio = this.ensureAudioEl();
            audio.loop = false;
            audio.src = objectUrl;
            audio.volume = this.volume;
            return audio.play();
          })
          .catch(() => {
            if (reqId === this.playRequestId && this.isPlayingMusic) {
              this.startSynthLoop(track.synthPreset || 'rose_waltz');
            }
          });
        return;
      }

      const audio = this.ensureAudioEl();
      audio.loop = false;
      audio.src = normalizeMediaUrl(rawUrl, 'audio');
      audio.volume = this.volume;
      audio.play().catch(() => {
        if (reqId === this.playRequestId && this.isPlayingMusic) {
          this.startSynthLoop(track.synthPreset || 'rose_waltz');
        }
      });
      return;
    }

    this.startSynthLoop(track.synthPreset || 'rose_waltz');
  }

  private startSynthLoop(presetKey: SynthPreset) {
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

  public pauseMusic() {
    this.isPlayingMusic = false;
    if (this.loopTimer !== null) {
      window.clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
    }
  }

  public resumeMusic(fallbackTrack?: MusicTrack) {
    if (this.currentTrack) {
      this.playTrack(this.currentTrack);
    } else if (fallbackTrack) {
      this.playTrack(fallbackTrack);
    }
  }

  public isPlaying() {
    return this.isPlayingMusic;
  }
}

export const soundEngine = new SoundEngine();
