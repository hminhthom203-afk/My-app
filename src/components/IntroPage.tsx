import React, { useState } from 'react';
import { motion } from 'motion/react';
import { soundEngine } from '../utils/soundEngine';
import { PetalCanvas } from './PetalCanvas';

interface IntroPageProps {
  onEnter: () => void;
}

const BG_IMAGE = '/assets/aistudio/b3d0d8ea8ac20daa182418f5c4ed3de2_3adce6a1.jpg';

export const IntroPage: React.FC<IntroPageProps> = ({ onEnter }) => {
  const [isClosed, setIsClosed] = useState(false);

  const handleClose = () => {
    setIsClosed(true);
    try {
      soundEngine.playChime();
    } catch {
      // ignore audio error
    }
    try {
      window.close();
    } catch {
      // browser blocked window.close
    }
  };

  const handleConfirmEnter = () => {
    onEnter();
  };

  if (isClosed) {
    return (
      <div className="relative flex min-h-screen w-full max-w-full flex-col items-center justify-center overflow-hidden bg-[#15020B] px-4 py-8 text-[#FFF0F5]">
        <img
          src={BG_IMAGE}
          alt="Nền hoàng hôn mộng mơ"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-20"
        />
        <div className="relative z-30 mx-auto flex w-full max-w-md flex-col items-center rounded-3xl border border-[#E2A6BA]/30 bg-[#240313]/90 px-6 py-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.85)] backdrop-blur-md">
          <h2
            className="font-artistic mb-3 text-4xl font-bold text-[#FFE5EE]"
            style={{
              textShadow:
                '0 0 12px rgba(255, 140, 185, 0.8), 0 0 24px rgba(255, 182, 217, 0.5), 0 2px 4px rgba(0,0,0,0.8)',
            }}
          >
            Hẹn gặp lại bạn nhé! 🍬
          </h2>
          <p className="mb-6 text-sm text-[#E2A6BA]/80">Trang web đã được đóng lại.</p>
          <button
            type="button"
            onClick={() => {
              setIsClosed(false);
              try {
                soundEngine.playChime();
              } catch {
                // ignore
              }
            }}
            className="font-artistic cursor-pointer touch-manipulation rounded-full border border-[#FFF0F5]/40 bg-white/10 px-8 py-2.5 text-2xl font-bold text-[#FFE5EE] transition-all hover:scale-105 hover:border-[#FFF0F5]/70 hover:bg-white/20"
            style={{
              textShadow: '0 0 10px rgba(255, 140, 185, 0.75), 0 2px 4px rgba(0,0,0,0.8)',
            }}
          >
            Mở lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full max-w-full flex-col items-center justify-center overflow-hidden bg-[#15020B] px-4 py-8 text-[#FFF0F5]">
      {/* Lớp nền và cánh hoa ở phía sau hoàn toàn, không nhận sự kiện chuột/chạm */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <img
          src={BG_IMAGE}
          alt="Nền hoàng hôn mộng mơ"
          className="h-full w-full object-cover"
        />
        {/* Độ che phủ 40% */}
        <div className="absolute inset-0 bg-[#15020B]/40" />
      </div>

      {/* Cánh hoa đào rơi tự nhiên */}
      <PetalCanvas
        variant="intro"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      />

      {/* Chữ Ăn Kẹo Hong? và hai lựa chọn Không / Có nằm ở lớp trên cùng */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-auto relative z-30 flex flex-col items-center justify-center px-4 text-center"
      >
        {/* Chữ Ăn Kẹo Hong? viết tay nghệ thuật phát sáng nhẹ */}
        <h1
          className="font-artistic mb-8 select-none text-5xl font-bold tracking-wide text-[#FFE8F0] sm:text-7xl"
          style={{
            textWrap: 'balance',
            textShadow:
              '0 0 16px rgba(255, 140, 185, 0.85), 0 0 32px rgba(255, 182, 217, 0.6), 0 2px 6px rgba(0,0,0,0.9)',
          }}
        >
          Ăn Kẹo Hong?
        </h1>

        {/* Hai lựa chọn: Không (bên trái) / Có (bên phải) với cỡ chữ bằng 1/2 tiêu đề */}
        <div className="relative z-30 flex items-center justify-center gap-4 sm:gap-6">
          {/* Nút Không (bên trái) */}
          <button
            type="button"
            onClick={handleClose}
            className="pointer-events-auto relative inline-flex min-h-[42px] min-w-[92px] cursor-pointer touch-manipulation select-none items-center justify-center rounded-full border border-[#FFF0F5]/55 bg-gradient-to-r from-[#3A071F]/90 via-[#52132D]/90 to-[#3A071F]/90 px-5 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.6),0_0_12px_rgba(255,140,185,0.3)] transition-transform duration-200 hover:-translate-y-0.5 hover:scale-105 hover:border-[#FFF0F5]/90 hover:shadow-[0_8px_22px_rgba(0,0,0,0.7),0_0_20px_rgba(255,182,217,0.6)] active:scale-95 sm:min-h-[46px] sm:min-w-[110px] sm:px-6"
          >
            <span
              className="font-artistic text-2xl font-bold tracking-wide text-[#FFD6E5] sm:text-3xl"
              style={{
                textShadow:
                  '0 0 8px rgba(255, 140, 185, 0.8), 0 0 16px rgba(255, 182, 217, 0.45), 0 2px 4px rgba(0,0,0,0.8)',
              }}
            >
              Không
            </span>
          </button>

          {/* Nút Có (bên phải) */}
          <button
            type="button"
            onClick={handleConfirmEnter}
            className="pointer-events-auto relative inline-flex min-h-[42px] min-w-[92px] cursor-pointer touch-manipulation select-none items-center justify-center rounded-full border border-[#FFF0F5]/65 bg-gradient-to-r from-[#6F1F3B]/90 via-[#8B264A]/90 to-[#6F1F3B]/90 px-5 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.6),0_0_14px_rgba(255,140,185,0.4)] transition-transform duration-200 hover:-translate-y-0.5 hover:scale-105 hover:border-[#FFF0F5] hover:shadow-[0_8px_22px_rgba(0,0,0,0.7),0_0_24px_rgba(255,182,217,0.7)] active:scale-95 sm:min-h-[46px] sm:min-w-[110px] sm:px-6"
          >
            <span
              className="font-artistic text-2xl font-bold tracking-wide text-[#FFE5EE] sm:text-3xl"
              style={{
                textShadow:
                  '0 0 8px rgba(255, 140, 185, 0.85), 0 0 16px rgba(255, 182, 217, 0.5), 0 2px 4px rgba(0,0,0,0.8)',
              }}
            >
              Có
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
