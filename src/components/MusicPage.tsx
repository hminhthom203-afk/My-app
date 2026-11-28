import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Volume2, VolumeX, Music2, Disc3, Shuffle, SkipForward } from 'lucide-react';
import { MusicTrack } from '../types';
import { soundEngine } from '../utils/soundEngine';

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface MusicPageProps {
  tracks: MusicTrack[];
  currentTrackId: string;
  isPlaying: boolean;
  isShuffle: boolean;
  sfxEnabled: boolean;
  onSelectTrack: (track: MusicTrack) => void;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onToggleShuffle: () => void;
  onToggleSfx: () => void;
  onPlayHoverSound: () => void;
}

export const MusicPage: React.FC<MusicPageProps> = ({
  tracks,
  currentTrackId,
  isPlaying,
  isShuffle,
  sfxEnabled,
  onSelectTrack,
  onTogglePlay,
  onNextTrack,
  onToggleShuffle,
  onToggleSfx,
  onPlayHoverSound,
}) => {
  const activeTrack = tracks.find((t) => t.id === currentTrackId) || tracks[0];
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const unsub = soundEngine.onTimeUpdate((cur, dur) => {
      setCurrentTime(cur);
      setDuration(dur);
    });
    return () => unsub();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="mx-auto w-full max-w-4xl px-4 pb-28 sm:px-6"
    >
      <div className="mb-8 text-center">
        <h1
          className="font-artistic mb-2 text-4xl font-bold tracking-wide text-[#9A3B12] sm:text-6xl"
          style={{
            textWrap: 'balance',
            textShadow:
              '0 2px 14px rgba(255, 255, 255, 0.98), 0 0 24px rgba(255, 240, 245, 0.95), 0 2px 4px rgba(154, 59, 18, 0.2)',
          }}
        >
          Hộp Nhạc
        </h1>
        <p className="inline-block rounded-full border border-[#B65A7C]/25 bg-white/80 px-5 py-1 text-xs font-semibold text-[#5E1131] shadow-sm backdrop-blur-sm sm:text-sm">
          Hộp Nhạc Của Kẹo
        </p>
      </div>

      {/* Now Playing Showcase */}
      {activeTrack && (
        <div className="mb-8 flex flex-col gap-5 rounded-3xl border border-[#B65A7C]/25 bg-gradient-to-br from-[#6F1F3B] to-[#3A071F] p-6 text-[#FFF0F5] shadow-[0_20px_50px_-15px_rgba(58,7,31,0.45)] sm:p-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#E2A6BA]/40 bg-[#FFF0F5]/10 ${
                  isPlaying ? 'animate-spin' : ''
                }`}
                style={{ animationDuration: '9s' }}
              >
                <Disc3 className="h-8 w-8 text-[#E2A6BA]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#E2A6BA]">
                  {isPlaying ? 'Đang phát' : 'Đang tạm dừng'}
                </p>
                <h2 className="font-cute truncate text-xl font-bold text-[#FFF0F5]">
                  {activeTrack.title}
                </h2>
                {Boolean(activeTrack.artist && activeTrack.artist.trim()) && (
                  <p className="truncate text-xs text-[#E2A6BA]/85">
                    {activeTrack.artist}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onTogglePlay}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-[#FFF0F5] px-6 py-2 text-sm font-bold text-[#3A071F] transition-transform hover:scale-[1.02]"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span className="whitespace-nowrap">{isPlaying ? 'Tạm dừng' : 'Phát nhạc'}</span>
              </button>

              <button
                type="button"
                onClick={onNextTrack}
                disabled={tracks.length === 0}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-[#E2A6BA]/40 bg-[#FFF0F5]/10 px-4 py-2 text-xs font-semibold text-[#FFF0F5] transition-colors hover:bg-[#FFF0F5]/20 disabled:opacity-50"
              >
                <SkipForward className="h-4 w-4" />
                <span className="whitespace-nowrap">Bài tiếp</span>
              </button>

              <button
                type="button"
                onClick={onToggleShuffle}
                aria-pressed={isShuffle}
                className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                  isShuffle
                    ? 'border-[#FFF0F5] bg-[#E2A6BA] text-[#3A071F]'
                    : 'border-[#E2A6BA]/40 bg-[#FFF0F5]/10 text-[#FFF0F5] hover:bg-[#FFF0F5]/20'
                }`}
              >
                <Shuffle className="h-4 w-4" />
                <span className="whitespace-nowrap">
                  {isShuffle ? 'Ngẫu nhiên: Bật' : 'Ngẫu nhiên: Tắt'}
                </span>
              </button>

              <button
                type="button"
                onClick={onToggleSfx}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-[#E2A6BA]/40 bg-[#FFF0F5]/10 px-4 py-2 text-xs font-semibold text-[#FFF0F5] transition-colors hover:bg-[#FFF0F5]/20"
              >
                {sfxEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <span className="whitespace-nowrap">
                  {sfxEnabled ? 'Âm chạm: Bật' : 'Âm chạm: Tắt'}
                </span>
              </button>
            </div>
          </div>

          {/* Thanh kéo thời gian cho nhạc (Seek Bar) */}
          <div className="w-full rounded-2xl bg-black/15 px-4 py-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="min-w-[34px] text-[11px] font-bold text-[#E2A6BA] tabular-nums">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration > 0 ? duration : 100}
                step={0.5}
                value={duration > 0 ? currentTime : 0}
                disabled={duration <= 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  soundEngine.seek(val);
                }}
                aria-label="Thanh kéo thời gian bài nhạc"
                className="h-2 w-full cursor-pointer accent-[#E2A6BA] disabled:opacity-30"
              />
              <span className="min-w-[34px] text-right text-[11px] font-bold text-[#E2A6BA] tabular-nums">
                {duration > 0 ? formatTime(duration) : activeTrack.durationLabel || '0:00'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Playlist */}
      {tracks.length === 0 ? (
        <div className="rounded-3xl border border-[#B65A7C]/20 bg-white/60 p-8 text-center text-sm text-[#6F1F3B]">
          Chưa có bản nhạc nào trong danh sách.
        </div>
      ) : (
        <ul className="space-y-3">
          {tracks.map((track, idx) => {
            const selected = track.id === activeTrack?.id;
            return (
              <li key={track.id}>
                <button
                  type="button"
                  onClick={() => onSelectTrack(track)}
                  onPointerEnter={onPlayHoverSound}
                  className={`flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-200 ${
                    selected
                      ? 'border-[#6F1F3B]/50 bg-white/95 shadow-sm'
                      : 'border-[#B65A7C]/20 bg-[#FFF0F5]/80 hover:bg-white/90'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E2A6BA]/35 text-xs font-bold text-[#3A071F] tabular-nums">
                      {selected && isPlaying ? (
                        <Music2 className="h-4 w-4 text-[#6F1F3B]" />
                      ) : (
                        String(idx + 1).padStart(2, '0')
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#3A071F]">{track.title}</p>
                      {Boolean(track.artist && track.artist.trim()) && (
                        <p className="truncate text-xs text-[#6F1F3B]/80">
                          {track.artist}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-[#B65A7C]">
                    {selected && isPlaying ? 'Đang phát' : track.durationLabel}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
};
