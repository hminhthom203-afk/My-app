import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  MessageSquare,
  Send,
  Trash2,
  Filter,
  ChevronDown,
  User,
} from 'lucide-react';
import { CommunityChatMessage, UserProfile } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface ChatPageProps {
  chatMessages: CommunityChatMessage[];
  currentUser: UserProfile | null;
  onSendChatMessage: (data: {
    characterId: string;
    characterName: string;
    tag: string;
    content: string;
  }) => Promise<boolean>;
  onDeleteChatMessage: (chatId: string) => Promise<void>;
  onRequestAuth: () => void;
  onPlayHoverSound: () => void;
}

const CATEGORY_TAGS = [
  { id: 'gop-y', label: '💬 Góp ý', color: 'bg-[#EDE9FE] border-[#DDD6FE] text-[#6D28D9]' },
  { id: 'y-tuong', label: '✨ Ý tưởng', color: 'bg-[#E0F2FE] border-[#BAE6FD] text-[#0284C7]' },
  { id: 'loi-nhan', label: '🌸 Lời nhắn', color: 'bg-[#FCE7F3] border-[#FBCFE8] text-[#DB2777]' },
];

export const ChatPage: React.FC<ChatPageProps> = ({
  chatMessages,
  currentUser,
  onSendChatMessage,
  onDeleteChatMessage,
  onRequestAuth,
  onPlayHoverSound,
}) => {
  const [selectedTag, setSelectedTag] = useState('💬 Góp ý');
  const [messageText, setMessageText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterTag, setFilterTag] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.emailVerified) {
      onRequestAuth();
      return;
    }

    const trimmed = messageText.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      const success = await onSendChatMessage({
        characterId: 'general',
        characterName: 'Góp ý chung',
        tag: selectedTag,
        content: trimmed.slice(0, 500),
      });

      if (success) {
        setMessageText('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId || deleting) return;
    setDeleting(true);
    try {
      await onDeleteChatMessage(pendingDeleteId);
      setPendingDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  // Filter messages by tag only
  const filteredMessages = useMemo(() => {
    return chatMessages.filter((msg) => {
      return filterTag === 'all' || msg.tag === filterTag;
    });
  }, [chatMessages, filterTag]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="mx-auto w-full max-w-4xl px-4 pb-28 sm:px-6"
    >
      {/* Page Title with soft pastel purple color */}
      <div className="mb-8 flex flex-col items-center text-center">
        <h1
          className="font-artistic mb-3 text-4xl font-bold tracking-wide text-[#7C3AED] sm:text-5xl"
          style={{
            textWrap: 'balance',
            paintOrder: 'stroke fill',
            WebkitTextStroke: '1px #FFFFFF',
            textShadow:
              '0 2px 14px rgba(255, 255, 255, 0.98), 0 0 24px rgba(237, 233, 254, 0.95), 0 2px 6px rgba(124, 58, 237, 0.15)',
          }}
        >
          Góc Trò Chuyện &amp; Góp Ý
        </h1>
        <div className="inline-flex items-center gap-3 rounded-full border border-[#DDD6FE]/60 bg-white/80 px-5 py-1.5 shadow-sm backdrop-blur-sm">
          <span aria-hidden="true" className="hidden h-px w-5 bg-[#A78BFA]/60 sm:block" />
          <p className="text-xs font-semibold text-[#6D28D9] sm:text-sm">
            Chia sẻ cảm nghĩ, trò chuyện vui vẻ hoặc đóng góp ý tưởng siêu đáng yêu nha!
          </p>
          <span aria-hidden="true" className="hidden h-px w-5 bg-[#A78BFA]/60 sm:block" />
        </div>
      </div>

      {/* Input / Post Message Section */}
      <div className="mb-8 overflow-hidden rounded-3xl border border-white/85 bg-white/40 p-5 shadow-[0_0_18px_rgba(255,255,255,0.7)] backdrop-blur-md sm:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#EDE9FE] text-[#7C3AED] shadow-sm">
              <MessageSquare className="h-4 w-4" />
            </span>
            <h2 className="font-cute text-base font-bold text-[#6D28D9] sm:text-lg">
              Để lại lời nhắn &amp; góp ý
            </h2>
          </div>

          {!currentUser ? (
            <button
              type="button"
              onClick={onRequestAuth}
              onPointerEnter={onPlayHoverSound}
              className="cursor-pointer text-xs font-semibold text-[#7C3AED] underline decoration-[#C4B5FD] underline-offset-4 hover:text-[#5B21B6]"
            >
              Đăng nhập để tham gia trò chuyện
            </button>
          ) : !currentUser.emailVerified ? (
            <button
              type="button"
              onClick={onRequestAuth}
              onPointerEnter={onPlayHoverSound}
              className="cursor-pointer rounded-full bg-[#7C3AED] px-3.5 py-1 text-xs font-bold text-[#FFF0F5] hover:bg-[#5B21B6]"
            >
              Xác minh Gmail để gửi lời nhắn
            </button>
          ) : (
            <span className="text-xs font-medium text-[#7C3AED]">
              Đăng bởi: <strong className="font-bold text-[#6D28D9]">{currentUser.name}</strong>
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tag Selection: Only Góp ý, Ý tưởng, Lời nhắn */}
          <div>
            <span className="mb-2 block text-xs font-bold text-[#6D28D9]">
              Chọn chủ đề lời nhắn:
            </span>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_TAGS.map((tag) => {
                const isSelected = selectedTag === tag.label;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      onPlayHoverSound();
                      setSelectedTag(tag.label);
                    }}
                    className={`inline-flex min-h-[40px] cursor-pointer items-center rounded-2xl border px-4 py-1.5 text-xs font-bold transition-all ${
                      isSelected
                        ? `${tag.color} ring-2 ring-white shadow-[0_0_12px_rgba(255,255,255,0.95)] scale-105`
                        : 'border-white/80 bg-white/50 text-[#6D28D9] hover:bg-white/80'
                    }`}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Area */}
          <div className="relative">
            <textarea
              id="chat-input"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={
                currentUser
                  ? `Viết bình luận, ý tưởng hay góp ý của bạn ở đây nè... (${selectedTag})`
                  : 'Hãy đăng nhập tài khoản đã xác minh Gmail để gửi lời nhắn nha...'
              }
              className="w-full rounded-2xl border border-white/90 bg-white/70 p-3.5 text-sm text-[#4A2858] placeholder-[#9CA3AF] shadow-inner backdrop-blur-sm focus:border-[#C4B5FD] focus:bg-white/90 focus:outline-none"
            />
            <div className="mt-1 flex items-center justify-between px-1 text-[11px] text-[#9CA3AF]">
              <span>Tối đa 500 ký tự</span>
              <span className="tabular-nums font-semibold">{messageText.length}/500</span>
            </div>
          </div>

          {/* Submit Row */}
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={submitting || !messageText.trim()}
              onPointerEnter={onPlayHoverSound}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#FDA4AF] bg-[#FFE4E6] px-7 py-2.5 text-sm font-bold text-[#9F1239] shadow-[0_0_12px_rgba(255,255,255,0.85)] transition-all hover:scale-105 hover:bg-[#FECDD3] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4 text-[#E11D48]" />
              <span>Gửi Lời Nhắn</span>
            </button>
          </div>
        </form>
      </div>

      {/* Decorative separator */}
      <div
        aria-hidden="true"
        className="my-7 flex items-center justify-center gap-3 select-none"
      >
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
        <span
          className="text-sm font-bold tracking-[0.35em] text-white sm:text-base"
          style={{
            paintOrder: 'stroke fill',
            WebkitTextStroke: '1.2px #C4B5FD',
            textShadow:
              '0 0 8px rgba(255, 255, 255, 0.98), 0 0 14px rgba(255, 255, 255, 0.85)',
          }}
        >
          ✦ · ✦ · ✦
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
      </div>

      {/* Filter Chips Bar (Category filter only: Góp ý, Ý tưởng, Lời nhắn) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/30 p-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1 text-xs font-bold text-[#6D28D9]">
            <Filter className="h-3.5 w-3.5 text-[#7C3AED]" />
            <span>Chủ đề:</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onPlayHoverSound();
              setFilterTag('all');
            }}
            className={`min-h-[34px] cursor-pointer rounded-full border px-3.5 py-1 text-xs font-bold transition-all ${
              filterTag === 'all'
                ? 'border-[#DDD6FE] bg-[#EDE9FE] text-[#6D28D9] shadow-sm'
                : 'border-white/80 bg-white/60 text-[#6D28D9] hover:bg-white'
            }`}
          >
            Tất cả ({chatMessages.length})
          </button>
          {CATEGORY_TAGS.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => {
                onPlayHoverSound();
                setFilterTag(tag.label);
              }}
              className={`min-h-[34px] cursor-pointer rounded-full border px-3.5 py-1 text-xs font-bold transition-all ${
                filterTag === tag.label
                  ? `${tag.color} ring-1 ring-white shadow-sm scale-105`
                  : 'border-white/80 bg-white/60 text-[#6D28D9] hover:bg-white'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-3.5">
        {filteredMessages.length === 0 ? (
          <div className="rounded-3xl border border-white/70 bg-white/30 p-10 text-center shadow-[0_0_12px_rgba(255,255,255,0.5)] backdrop-blur-sm">
            <p className="font-cute text-base font-bold text-[#6D28D9] sm:text-lg">
              {chatMessages.length === 0
                ? 'Chưa có lời nhắn hay góp ý nào.'
                : 'Không có lời nhắn nào phù hợp với bộ lọc.'}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#8B5CF6]">
              Hãy là người đầu tiên chia sẻ cảm nghĩ và gửi góp ý siêu đáng yêu nhé!
            </p>
          </div>
        ) : (
          filteredMessages.slice(0, visibleCount).map((msg) => {
            const isOwner = currentUser?.uid === msg.authorUid;
            const canDelete = Boolean(
              currentUser && (currentUser.role === 'admin' || isOwner)
            );

            return (
              <div
                key={msg.id}
                className="group relative flex flex-col gap-2.5 rounded-3xl border border-white/85 bg-white/45 p-4 shadow-[0_0_12px_rgba(255,255,255,0.6)] backdrop-blur-md transition-all hover:bg-white/60 sm:p-5"
              >
                {/* Header row: Author + Tag + Timestamp + Delete */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Author Pill */}
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/90 bg-white/75 px-2.5 py-0.5 font-bold text-[#4A2858] shadow-sm">
                      <User className="h-3 w-3 text-[#7C3AED]" />
                      <span>{msg.authorName}</span>
                    </span>

                    {/* Category Tag */}
                    <span className="inline-flex items-center rounded-full border border-white/80 bg-white/80 px-2.5 py-0.5 font-bold text-[#6D28D9] shadow-sm">
                      {msg.tag}
                    </span>

                    <span className="text-[11px] font-medium text-[#9CA3AF] tabular-nums">
                      {new Date(msg.createdAt).toLocaleDateString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Delete Action */}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        onPlayHoverSound();
                        setPendingDeleteId(msg.id);
                      }}
                      aria-label="Xoá lời nhắn"
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#B65A7C] transition-colors hover:bg-[#FFE4E6] hover:text-[#E11D48]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Message Body */}
                <p className="break-words px-1 text-sm leading-relaxed text-[#4A2858]/90 sm:text-base">
                  {msg.content}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Xem thêm Pagination Button */}
      {filteredMessages.length > visibleCount && (
        <div className="mt-7 flex justify-center">
          <button
            type="button"
            onClick={() => {
              onPlayHoverSound();
              setVisibleCount((prev) => prev + 10);
            }}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-white bg-white/20 px-7 py-2 text-xs font-bold text-[#6D28D9] shadow-[0_0_12px_rgba(255,255,255,0.85)] backdrop-blur-sm transition-all hover:bg-white/35 hover:shadow-[0_0_16px_rgba(255,255,255,1)]"
          >
            <ChevronDown className="h-4 w-4" />
            <span>
              Xem thêm ({Math.min(10, filteredMessages.length - visibleCount)} lời nhắn nữa)
            </span>
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        title="Xác nhận xoá lời nhắn"
        description="Bạn có chắc chắn muốn xoá lời nhắn trò chuyện này không? Thao tác này không thể hoàn tác."
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </motion.div>
  );
};
