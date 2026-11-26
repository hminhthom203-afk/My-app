import React from 'react';
import { motion } from 'motion/react';
import { Play, Pause, Volume2, VolumeX, Music2, Disc3 } from 'lucide-react';
import { MusicTrack } from '../types';

interface MusicPageProps {
  tracks: MusicTrack[];
  currentTrackId: string;
  isPlaying: boolean;
  volume: number;
  sfxEnabled: boolean;
  onSelectTrack: (track: MusicTrack) => void;
  onTogglePlay: () => void;
  onChangeVolume: (v: number) => void;
  onToggleSfx: () => void;
  onPlayHoverSound: () => void;
}

export const MusicPage: React.FC<MusicPageProps> = ({
  tracks,
  currentTrackId,
  isPlaying,
  volume,
  sfxEnabled,
  onSelectTrack,
  onTogglePlay,
  onChangeVolume,
  onToggleSfx,
  onPlayHoverSound,
}) => {
  const activeTrack = tracks.find((t) => t.id === currentTrackId) || tracks[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-4xl px-4 pt-4 pb-28 sm:px-6"
    >
      <div className="mb-8 text-center">
        <h1
          className="font-cute mb-2 bg-gradient-to-r from-[#6F1F3B] via-[#B65A7C] to-[#8E2B4E] bg-clip-text text-3xl font-bold text-transparent sm:text-4xl"
          style={{ textWrap: 'balance' }}
        >
          Hộp Nhạc
        </h1>
        <p className="mx-auto max-w-lg text-sm font-medium text-[#6F1F3B]">
          Hộp Nhạc Của Kẹo
        </p>
      </div>

      {/* Now Playing Showcase */}
      {activeTrack && (
        <div className="mb-8 flex flex-col items-center justify-between gap-6 rounded-3xl border border-[#B65A7C]/25 bg-gradient-to-br from-[#6F1F3B] to-[#3A071F] p-6 text-[#FFF0F5] shadow-[0_20px_50px_-15px_rgba(58,7,31,0.45)] sm:flex-row sm:p-8">
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
              <p className="truncate text-xs text-[#E2A6BA]/85">
                {activeTrack.artist} · {activeTrack.mood}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
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
      )}

      {/* Volume control */}
      <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-[#B65A7C]/20 bg-[#FFF0F5]/85 px-5 py-3.5 backdrop-blur-sm">
        <span className="text-xs font-semibold text-[#6F1F3B] whitespace-nowrap">
          Âm lượng nhạc nền
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={volume}
          onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
          aria-label="Âm lượng nhạc nền"
          className="h-2 w-full max-w-xs cursor-pointer accent-[#6F1F3B]"
        />
        <span className="w-10 text-right text-xs font-bold text-[#3A071F] tabular-nums">
          {Math.round(volume * 100)}%
        </span>
      </div>

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
                      <p className="truncate text-xs text-[#6F1F3B]/80">
                        {track.artist} · {track.mood}
                      </p>
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
