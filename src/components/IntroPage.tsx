import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { INTRO_BG_IMAGE } from '../data/initialData';

interface IntroPageProps {
  onEnter: () => void;
}

export const IntroPage: React.FC<IntroPageProps> = ({ onEnter }) => {
  return (
    <div className="relative flex min-h-screen w-full max-w-full flex-col items-center justify-center overflow-hidden bg-[#3A071F] px-4 py-12 text-[#FFF0F5]">
      <img
        src={INTRO_BG_IMAGE}
        alt="Nền nhung hoa hồng"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#3A071F]/75 via-[#6F1F3B]/50 to-[#3A071F]/90"
      />

      <div
        aria-hidden="true"
        className="animate-aura pointer-events-none absolute h-[340px] w-[340px] rounded-full bg-[#E2A6BA]/20 blur-3xl sm:h-[480px] sm:w-[480px]"
      />

      <motion.div
        initial={{ opacity: 0, y: 20, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        className="animate-float-3d relative z-20 mx-auto flex w-full max-w-md flex-col items-center rounded-3xl border border-[#E2A6BA]/30 bg-[#3A071F]/60 px-6 py-12 text-center shadow-[0_24px_70px_-15px_rgba(0,0,0,0.65)] backdrop-blur-md sm:px-10 sm:py-14"
      >
        <h1
          className="font-cute mb-8 bg-gradient-to-r from-[#FFF0F5] via-[#FFBDD6] to-[#E2A6BA] bg-clip-text text-4xl font-bold tracking-tight text-transparent drop-shadow-[0_4px_18px_rgba(255,189,214,0.5)] sm:text-6xl"
          style={{ textWrap: 'balance' }}
        >
          Ăn Kẹo Hong
        </h1>

        <button
          type="button"
          onClick={onEnter}
          className="group inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#E2A6BA] via-[#FFF0F5] to-[#E2A6BA] px-9 py-3.5 text-base font-bold text-[#3A071F] shadow-[0_12px_32px_-8px_rgba(226,166,186,0.75)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-6px_rgba(255,240,245,0.85)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FFF0F5] active:translate-y-0"
        >
          <span>Tham quan</span>
          <ArrowRight className="h-4 w-4 text-[#6F1F3B] transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </motion.div>
    </div>
  );
};
