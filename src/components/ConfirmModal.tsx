import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Xác nhận xoá',
  cancelLabel = 'Huỷ',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#3A071F]/60 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!loading) onCancel();
          }}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-desc"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl border border-[#B65A7C]/35 bg-[#FFF0F5] p-6 text-[#3A071F] shadow-[0_24px_64px_-12px_rgba(58,7,31,0.5)]"
          >
            <button
              type="button"
              disabled={loading}
              onClick={onCancel}
              aria-label="Đóng"
              className="absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#6F1F3B] transition-colors hover:bg-[#E2A6BA]/35 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E2A6BA]/35 text-[#6F1F3B]">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <h2 id="confirm-modal-title" className="font-cute mb-1.5 text-lg font-bold text-[#3A071F]">
              {title}
            </h2>
            <p id="confirm-modal-desc" className="mb-6 text-sm leading-relaxed text-[#6F1F3B]">
              {description}
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={loading}
                onClick={onCancel}
                className="min-h-[42px] cursor-pointer rounded-full border border-[#B65A7C]/35 bg-white px-5 py-2 text-xs font-bold text-[#6F1F3B] transition-colors hover:bg-[#E2A6BA]/20 disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onConfirm}
                className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#6F1F3B] px-5 py-2 text-xs font-bold text-[#FFF0F5] shadow-sm transition-colors hover:bg-[#3A071F] disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{loading ? 'Đang xoá...' : confirmLabel}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
