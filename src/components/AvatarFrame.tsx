import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface AvatarFrameProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'card';
  className?: string;
}

export const AvatarFrame: React.FC<AvatarFrameProps> = ({
  src,
  alt,
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);

  useEffect(() => {
    setImgError(false);
    setFallbackSrc(null);
  }, [src]);

  const activeSrc = fallbackSrc || src;

  const handleImgError = () => {
    if (!fallbackSrc && src.startsWith('/api/drive-media')) {
      try {
        const parsed = new URL(src, 'http://localhost');
        const id = parsed.searchParams.get('id');
        if (id) {
          setFallbackSrc(`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1000`);
          return;
        }
      } catch {
        // ignore URL parse error
      }
    }
    setImgError(true);
  };

  if (size === 'card') {
    return (
      <div
        className={`relative aspect-square shrink-0 w-full overflow-hidden rounded-2xl border-[1.25px] border-[#C4B5FD] bg-[#F5F3FF] shadow-[0_6px_16px_-6px_rgba(120,90,160,0.22)] ${className}`}
      >
        {!imgError && activeSrc ? (
          <img
            src={activeSrc}
            alt={alt}
            referrerPolicy="no-referrer"
            onError={handleImgError}
            className="block h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#D6ECFA]/60 to-[#E5DEFF]/60 text-[#5E1131]">
            <Sparkles className="h-8 w-8 opacity-75" />
          </div>
        )}
      </div>
    );
  }

  const dims =
    size === 'sm'
      ? 'h-16 w-16 rounded-xl'
      : size === 'lg'
        ? 'h-48 w-48 rounded-2xl sm:h-56 sm:w-56'
        : 'h-28 w-28 rounded-2xl sm:h-32 sm:w-32';

  return (
    <div
      className={`relative aspect-square shrink-0 overflow-hidden border-[1.25px] border-[#C4B5FD] bg-[#F5F3FF] shadow-[0_0_12px_rgba(255,255,255,0.85),0_8px_18px_-8px_rgba(120,90,160,0.22)] ring-1 ring-white/90 ${dims} ${className}`}
    >
      {!imgError && activeSrc ? (
        <img
          src={activeSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={handleImgError}
          className="block h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#D6ECFA]/60 to-[#E5DEFF]/60 text-[#5E1131]">
          <Sparkles className="h-6 w-6 opacity-75" />
        </div>
      )}
    </div>
  );
};

