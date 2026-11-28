import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Trash2, Heart, MessageCircle, CheckCheck } from 'lucide-react';
import { AdminNotification } from '../types';

interface NotificationModalProps {
  isOpen: boolean;
  notifications: AdminNotification[];
  onClose: () => void;
  onOpenCharacter: (characterId: string) => void;
  onOpenChat: () => void;
  onMarkAllRead: () => void;
  onDeleteNotification: (id: string) => void;
  onDeleteAllNotifications: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  notifications,
  onClose,
  onOpenCharacter,
  onOpenChat,
  onMarkAllRead,
  onDeleteNotification,
  onDeleteAllNotifications,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-modal-title"
        className="fixed inset-0 z-50 flex items-start justify-center sm:justify-end p-4 pt-16 sm:p-6 sm:pt-16 bg-[#3A071F]/40 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex w-full max-w-sm flex-col max-h-[82vh] overflow-hidden rounded-3xl border border-white/95 bg-[#FFF0F5]/96 p-5 text-[#3A071F] shadow-[0_20px_50px_rgba(111,31,59,0.25)] backdrop-blur-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#B65A7C]/20">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#EDE9FE] text-[#7C3AED] shadow-sm">
                <Bell className="h-4 w-4" />
              </span>
              <div>
                <h2 id="notif-modal-title" className="font-cute text-base font-bold text-[#5E0B33]">
                  Thông Báo Quản Trị
                </h2>
                <span className="text-[11px] font-semibold text-[#8C1B4A]">
                  {unreadCount > 0 ? `${unreadCount} thông báo mới` : 'Hộp thư quản trị'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      title="Đánh dấu tất cả đã đọc"
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#6F1F3B] hover:bg-[#E2A6BA]/30"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onDeleteAllNotifications}
                    title="Xóa tất cả thông báo"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#B65A7C] hover:bg-[#FFE4E6] hover:text-[#E11D48]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng bảng thông báo"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#6F1F3B] hover:bg-[#E2A6BA]/30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List of notifications */}
          <div className="mt-3 flex-1 overflow-y-auto pr-1 space-y-2.5">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-3xl mb-2">🌸</p>
                <p className="font-cute text-sm font-bold text-[#5E0B33]">
                  Chưa có thông báo nào
                </p>
                <p className="mt-1 text-xs text-[#8C1B4A]/80">
                  Khi có người xem thả tim hoặc bình luận, thông báo sẽ hiện tại đây nha!
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isLike = notif.type === 'like';
                const isChat = notif.characterId === 'general';

                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (isChat) {
                        onOpenChat();
                        onClose();
                      } else if (notif.characterId) {
                        onOpenCharacter(notif.characterId);
                        onClose();
                      }
                    }}
                    className={`group relative flex cursor-pointer items-start justify-between gap-2.5 rounded-2xl border p-3 transition-all hover:scale-[1.01] ${
                      !notif.read
                        ? 'border-[#FDA4AF] bg-white/95 shadow-sm'
                        : 'border-white/70 bg-white/55 opacity-85 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          isLike
                            ? 'bg-[#FFE4E6] text-[#E11D48]'
                            : 'bg-[#EDE9FE] text-[#7C3AED]'
                        }`}
                      >
                        {isLike ? (
                          <Heart className="h-3.5 w-3.5 fill-current" />
                        ) : (
                          <MessageCircle className="h-3.5 w-3.5" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          <span className="font-bold text-[#3A071F] truncate">{notif.actorName}</span>
                          <span className="text-[11px] text-[#8C1B4A]/80">
                            {isLike ? 'đã thả tim nhân vật' : 'đã gửi bình luận'}
                          </span>
                        </div>

                        <p className="mt-0.5 text-xs font-semibold text-[#5E0B33] truncate">
                          {isChat ? 'Mục: Góc Trò Chuyện' : `Nhân vật: ${notif.characterName}`}
                        </p>

                        {!isLike && notif.message && (
                          <p className="mt-1 text-xs text-[#3A071F]/85 line-clamp-2 italic bg-black/5 rounded-lg px-2 py-1">
                            “{notif.message}”
                          </p>
                        )}

                        <span className="mt-1 block text-[10px] text-[#8C1B4A]/70 tabular-nums">
                          {new Date(notif.createdAt).toLocaleDateString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNotification(notif.id);
                        }}
                        aria-label="Xóa thông báo này"
                        className="opacity-65 hover:opacity-100 p-1 rounded-full text-[#B65A7C] hover:bg-[#FFE4E6] hover:text-[#E11D48]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
