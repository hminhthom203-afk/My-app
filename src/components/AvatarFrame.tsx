import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface AvatarFrameProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
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

  const dims =
    size === 'sm'
      ? 'w-16 h-16'
      : size === 'lg'
        ? 'w-44 h-44 sm:w-56 sm:h-56'
        : 'w-28 h-28 sm:w-32 sm:h-32';

  const outerPad = size === 'lg' ? 'p-2.5' : size === 'sm' ? 'p-1' : 'p-2';

  return (
    <div className={`relative inline-flex items-center justify-center ${dims} ${className}`}>
      {/* Soft ambient rose halo harmonizing frame with background */}
      <div
        aria-hidden="true"
        className="absolute -inset-2 rounded-full bg-gradient-to-tr from-[#6F1F3B]/25 via-[#E2A6BA]/45 to-[#FFF0F5]/80 blur-md"
      />

      {/* Outer ornamental velvet-rose ring */}
      <div
        className={`relative h-full w-full rounded-full bg-gradient-to-br from-[#FFF0F5] via-[#E2A6BA] to-[#6F1F3B] ${outerPad} shadow-[0_10px_28px_-8px_rgba(58,7,31,0.35)] ring-1 ring-[#6F1F3B]/25`}
      >
        {/* Inner ivory pearl bevel */}
        <div className="h-full w-full overflow-hidden rounded-full bg-[#FFF0F5] p-0.5 ring-1 ring-[#FFF0F5]">
          {!imgError && activeSrc ? (
            <img
              src={activeSrc}
              alt={alt}
              referrerPolicy="no-referrer"
              onError={handleImgError}
              className="h-full w-full rounded-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#E2A6BA]/50 to-[#B65A7C]/40 text-[#6F1F3B]">
              <Sparkles className="h-6 w-6 opacity-75" />
            </div>
          )}
        </div>
      </div>

      {/* Delicate corner floral petal accents (SVG) */}
      {size !== 'sm' && (
        <>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute -top-1.5 -right-1.5 h-6 w-6 text-[#6F1F3B] drop-shadow-sm"
            fill="none"
          >
            <path
              d="M12 2C13.8 6.2 17.8 10.2 22 12C17.8 13.8 13.8 17.8 12 22C10.2 17.8 6.2 13.8 2 12C6.2 10.2 10.2 6.2 12 2Z"
              fill="#FFF0F5"
              stroke="#B65A7C"
              strokeWidth="1.2"
            />
          </svg>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute -bottom-1 -left-1 h-4 w-4 text-[#B65A7C] opacity-85"
            fill="none"
          >
            <path
              d="M12 3C13.5 7 17 10.5 21 12C17 13.5 13.5 17 12 21C10.5 17 7 13.5 3 12C7 10.5 10.5 7 12 3Z"
              fill="#E2A6BA"
              stroke="#6F1F3B"
              strokeWidth="1.2"
            />
          </svg>
        </>
      )}
    </div>
  );
};
