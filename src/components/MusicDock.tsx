import React from 'react';
import { Disc3, Music2 } from 'lucide-react';
import { MusicTrack } from '../types';

interface MusicDockProps {
  currentTrack: MusicTrack | undefined;
  isPlaying: boolean;
  isShuffle: boolean;
  sfxEnabled: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onToggleShuffle: () => void;
  onToggleSfx: () => void;
  onOpenMusicPage: () => void;
}

export const MusicDock: React.FC<MusicDockProps> = ({
  currentTrack,
  isPlaying,
  onOpenMusicPage,
}) => {
  if (!currentTrack) return null;

  return (
    <button
      type="button"
      onClick={onOpenMusicPage}
      title={`${isPlaying ? 'Đang phát' : 'Tạm dừng'}: ${currentTrack.title} — Bấm để mở Hộp Nhạc`}
      aria-label={`${isPlaying ? 'Đang phát' : 'Tạm dừng'}: ${currentTrack.title}. Bấm để chuyển sang mục Âm Nhạc`}
      className="group fixed right-4 bottom-4 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-2 border-white/95 bg-gradient-to-br from-[#6F1F3B] via-[#3A071F] to-[#831843] shadow-[0_8px_24px_rgba(58,7,31,0.42),0_0_16px_rgba(255,214,230,0.85)] transition-transform duration-200 hover:scale-108 active:scale-95 sm:right-5 sm:bottom-5 sm:h-16 sm:w-16"
    >
      {/* Spinning vinyl disc */}
      <span
        className="relative flex h-full w-full items-center justify-center rounded-full animate-[spin_5s_linear_infinite]"
        style={{
          animationPlayState: isPlaying ? 'running' : 'paused',
        }}
      >
        {/* Subtle vinyl groove rings */}
        <span
          aria-hidden="true"
          className="absolute inset-1.5 rounded-full border border-[#FFD6E6]/25"
        />
        <span
          aria-hidden="true"
          className="absolute inset-3 rounded-full border border-[#FFD6E6]/20"
        />
        <Disc3 className="h-7 w-7 text-[#FFD6E6] sm:h-8 sm:w-8" />
        {/* Center pastel spindle label */}
        <span
          aria-hidden="true"
          className="absolute h-3 w-3 rounded-full border border-[#6F1F3B]/50 bg-[#FFF0F5] shadow-inner"
        />
      </span>

      {/* Cute music note indicator badge when playing */}
      {isPlaying && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-[#FFE4E6] text-[#E11D48] shadow-sm animate-bounce"
        >
          <Music2 className="h-2.5 w-2.5" />
        </span>
      )}
    </button>
  );
};
