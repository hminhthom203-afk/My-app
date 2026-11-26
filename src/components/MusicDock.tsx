import React from 'react';
import { Play, Pause, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { MusicTrack } from '../types';

interface MusicDockProps {
  currentTrack: MusicTrack | undefined;
  isPlaying: boolean;
  sfxEnabled: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onToggleSfx: () => void;
  onOpenMusicPage: () => void;
}

export const MusicDock: React.FC<MusicDockProps> = ({
  currentTrack,
  isPlaying,
  sfxEnabled,
  onTogglePlay,
  onNextTrack,
  onToggleSfx,
  onOpenMusicPage,
}) => {
  if (!currentTrack) return null;

  return (
    <div className="fixed right-3 bottom-3 left-3 z-40 mx-auto flex h-12 max-w-md items-center justify-between gap-2 rounded-full border border-[#B65A7C]/35 bg-[#3A071F]/92 px-3 text-[#FFF0F5] shadow-[0_10px_30px_-8px_rgba(58,7,31,0.55)] backdrop-blur-md sm:left-auto sm:right-5 sm:bottom-5 sm:w-auto sm:min-w-[320px]">
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? 'Tạm dừng nhạc' : 'Phát nhạc'}
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#E2A6BA] text-[#3A071F] transition-transform hover:scale-105"
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      <button
        type="button"
        onClick={onOpenMusicPage}
        className="min-w-0 flex-1 cursor-pointer truncate px-1 text-left"
      >
        <span className="block truncate text-xs font-semibold text-[#FFF0F5]">
          {currentTrack.title}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onNextTrack}
          aria-label="Bài tiếp theo"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#E2A6BA] transition-colors hover:bg-white/10 hover:text-[#FFF0F5]"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onToggleSfx}
          aria-label={sfxEnabled ? 'Tắt âm thanh tương tác' : 'Bật âm thanh tương tác'}
          title={sfxEnabled ? 'Âm chạm đang bật' : 'Âm chạm đang tắt'}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#E2A6BA] transition-colors hover:bg-white/10 hover:text-[#FFF0F5]"
        >
          {sfxEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};
