import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  MessageCircle,
  Send,
  Trash2,
  Pencil,
  Check,
  X,
  BookOpen,
  ShoppingBag,
  ChevronDown,
} from 'lucide-react';
import { Character, CharacterComment, UserProfile } from '../types';
import { AvatarFrame } from './AvatarFrame';
import { Tilt3DCard } from './Tilt3DCard';
import { ConfirmModal } from './ConfirmModal';
import { getPastelTagClass, SLOGAN_BOX_CLASS } from '../utils/pastelTags';

interface CharacterDetailPageProps {
  character: Character;
  comments: CharacterComment[];
  isLiked: boolean;
  currentUser: UserProfile | null;
  onBack: () => void;
  onToggleLike: (characterId: string) => void;
  onAddComment: (characterId: string, content: string) => Promise<boolean>;
  onUpdateComment: (characterId: string, commentId: string, content: string) => Promise<void>;
  onDeleteComment: (characterId: string, commentId: string) => Promise<void>;
  onRequestAuth: () => void;
  onPlayHoverSound: () => void;
}

export const CharacterDetailPage: React.FC<CharacterDetailPageProps> = ({
  character,
  comments,
  isLiked: _isLiked,
  currentUser,
  onBack,
  onToggleLike: _onToggleLike,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onRequestAuth,
  onPlayHoverSound,
}) => {
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.emailVerified) {
      setAuthNotice('Bạn cần đăng nhập tài khoản đã xác minh để gửi lời nhắn.');
      onRequestAuth();
      return;
    }
    const trimmed = commentText.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const ok = await onAddComment(character.id, trimmed);
      if (ok) {
        setCommentText('');
        setAuthNotice(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;
    await onUpdateComment(character.id, commentId, trimmed);
    setEditingId(null);
    setEditingText('');
  };

  const handleConfirmDeleteComment = async () => {
    if (!pendingDeleteCommentId || deletingComment) return;
    setDeletingComment(true);
    try {
      await onDeleteComment(character.id, pendingDeleteCommentId);
      setPendingDeleteCommentId(null);
    } finally {
      setDeletingComment(false);
    }
  };

  const safeHref =
    character.link && /^https?:\/\//i.test(character.link)
      ? character.link
      : character.link
        ? `https://${character.link}`
        : '';

  return (
    <motion.div
      key={character.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="mx-auto w-full max-w-4xl px-4 pb-24 sm:px-6"
    >
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          onPointerEnter={onPlayHoverSound}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-white bg-white/10 px-5 py-2 text-sm font-bold text-[#5E1131] shadow-[0_0_12px_rgba(255,255,255,0.85)] backdrop-blur-sm transition-all duration-200 hover:-translate-x-0.5 hover:border-white hover:bg-white/20 hover:shadow-[0_0_16px_rgba(255,255,255,1)] focus-visible:outline-2 focus-visible:outline-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="whitespace-nowrap">Quay lại danh sách</span>
        </button>
      </div>

      {/* Main Dedicated Profile Card - reduced opacity to 20% background */}
      <div className="overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-br from-[#F8F7FF]/20 via-[#F3E8FF]/15 to-[#EFF6FF]/20 p-6 shadow-[0_12px_36px_-18px_rgba(124,58,237,0.1)] backdrop-blur-md sm:p-10">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
          {/* Left: Framed Avatar Only */}
          <div className="flex shrink-0 flex-col items-center">
            <Tilt3DCard maxTilt={7} onHoverSound={onPlayHoverSound}>
              <div className="animate-float-3d group">
                <AvatarFrame src={character.avatar} alt={character.name} size="lg" />
              </div>
            </Tilt3DCard>
          </div>

          {/* Right: Name, Hashtags, Slogan, Story, Link */}
          <div className="min-w-0 flex-1 text-center md:text-left">
            <h1
              className="font-cute mb-3 text-3xl font-extrabold tracking-tight text-[#5E0B33] sm:text-4xl"
              style={{
                textWrap: 'balance',
                paintOrder: 'stroke fill',
                WebkitTextStroke: '3.5px #FFFFFF',
                textShadow:
                  '0 0 12px rgba(255, 255, 255, 0.98), 0 2px 6px rgba(94, 11, 51, 0.2)',
              }}
            >
              {character.name}
            </h1>

            {character.hashtags.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                {character.hashtags.map((tag, index) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center rounded-full border-[1.5px] border-white px-3 py-0.5 text-xs font-bold shadow-[0_0_8px_rgba(255,255,255,0.98),0_0_14px_rgba(255,255,255,0.75),0_2px_6px_rgba(40,60,90,0.12)] ${getPastelTagClass(
                      index
                    )}`}
                  >
                    #{tag.replace(/^#/, '')}
                  </span>
                ))}
              </div>
            )}

            <p className={`mb-6 rounded-2xl px-3.5 py-2 text-xs leading-relaxed font-semibold italic ${SLOGAN_BOX_CLASS}`}>
              “{character.slogan}”
            </p>

            <div className="mb-6">
              <h2 className="font-cute mb-2.5 flex items-center justify-center gap-2 text-lg font-bold text-[#3A071F] md:justify-start">
                <BookOpen className="h-4 w-4 text-[#B65A7C]" />
                <span>Cốt truyện</span>
              </h2>
              <div className="space-y-3 text-left text-sm leading-relaxed text-[#3A071F]/90 sm:text-base">
                {character.story.split('\n').map((para, idx) =>
                  para.trim() ? <p key={idx}>{para}</p> : null
                )}
              </div>
            </div>

            {safeHref && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 md:justify-start">
                <a
                  href={safeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onPointerEnter={onPlayHoverSound}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-white/95 bg-[#FED7AA]/90 px-6 py-2.5 text-sm font-bold text-[#8A2C0D] shadow-[0_0_12px_rgba(255,255,255,0.9)] transition-all hover:scale-105 hover:bg-[#FDBA74]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span className="underline decoration-current underline-offset-4">Mua Kẹo Tại Đây</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages / Comments Section */}
      <section id="comments-section" className="mt-8 rounded-3xl border border-white/60 bg-[#FFF0F5]/10 p-6 shadow-[0_0_14px_rgba(255,255,255,0.6)] backdrop-blur-sm sm:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-cute inline-flex flex-wrap items-center gap-2 rounded-2xl border border-[#FDA4AF] bg-[#FFE4E6]/85 px-4 py-2 text-lg font-bold text-[#9F1239] shadow-[0_0_10px_rgba(255,255,255,0.85)] sm:text-xl">
            <MessageCircle className="h-5 w-5 text-[#E11D48]" />
            <span>Gửi lời nhắn đến {character.name}</span>
            <span className="text-xs font-semibold text-[#9F1239]/80 tabular-nums">
              ({comments.length})
            </span>
          </h2>
          {!currentUser ? (
            <button
              type="button"
              onClick={onRequestAuth}
              className="cursor-pointer text-xs font-semibold text-[#6F1F3B] underline decoration-[#B65A7C] underline-offset-4 hover:text-[#3A071F]"
            >
              Đăng nhập để gửi lời nhắn
            </button>
          ) : !currentUser.emailVerified ? (
            <button
              type="button"
              onClick={onRequestAuth}
              className="cursor-pointer rounded-full bg-[#6F1F3B] px-3.5 py-1.5 text-xs font-bold text-[#FFF0F5] hover:bg-[#3A071F]"
            >
              Xác minh Gmail ngay
            </button>
          ) : null}
        </div>

        {currentUser && !currentUser.emailVerified && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#6F1F3B]/30 bg-[#E2A6BA]/35 px-4 py-2.5 text-xs font-semibold text-[#3A071F]">
            <span>
              Tài khoản {currentUser.email} chưa xác minh Gmail nên chưa thể gửi lời nhắn.
            </span>
            <button
              type="button"
              onClick={onRequestAuth}
              className="cursor-pointer font-bold text-[#6F1F3B] underline underline-offset-4 hover:text-[#3A071F]"
            >
              Mở hướng dẫn xác minh
            </button>
          </div>
        )}

        {authNotice && (
          <div className="mb-4 rounded-xl border border-[#B65A7C]/30 bg-[#E2A6BA]/25 px-4 py-2.5 text-xs font-medium text-[#3A071F]">
            {authNotice}
          </div>
        )}

        <form onSubmit={handleSubmitComment} className="mb-6 flex flex-col gap-3 sm:flex-row">
          <input
            id="comment-input"
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            maxLength={500}
            placeholder={
              currentUser
                ? `Viết lời nhắn của ${currentUser.name} gửi đến ${character.name}...`
                : 'Đăng nhập để gửi lời nhắn...'
            }
            className="min-h-[44px] flex-1 rounded-2xl border border-white/80 bg-white/60 px-4 py-2.5 text-sm text-[#3A071F] placeholder-[#B65A7C]/70 shadow-sm backdrop-blur-sm focus:border-[#FDA4AF] focus:bg-white/90 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#FDA4AF] bg-[#FFE4E6] px-6 py-2.5 text-sm font-bold text-[#9F1239] shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-all hover:scale-105 hover:bg-[#FECDD3] disabled:opacity-60"
          >
            <Send className="h-4 w-4 text-[#E11D48]" />
            <span className="whitespace-nowrap">Gửi</span>
          </button>
        </form>

        {/* Divider ngăn cách mục gửi lời nhắn với danh sách lời nhắn đã gửi */}
        <div
          aria-hidden="true"
          className="my-7 flex items-center justify-center gap-3 select-none"
        >
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
          <span
            className="text-sm font-bold tracking-[0.35em] text-white sm:text-base"
            style={{
              paintOrder: 'stroke fill',
              WebkitTextStroke: '1.2px #FDA4AF',
              textShadow:
                '0 0 8px rgba(255, 255, 255, 0.98), 0 0 14px rgba(255, 255, 255, 0.85)',
            }}
          >
            ✦ · ✦ · ✦
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
        </div>

        {comments.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-[#9F1239]/85">
            Chưa có lời nhắn nào. Hãy là người đầu tiên gửi lời nhắn đến {character.name}!
          </p>
        ) : (
          <>
            <ul className="space-y-3">
              {comments.slice(0, visibleCount).map((cmt) => {
                const isOwner = currentUser?.uid === cmt.authorUid;
                const canDelete = Boolean(
                  currentUser && (currentUser.role === 'admin' || isOwner)
                );
                const isEditing = editingId === cmt.id;

                return (
                  <li
                    key={cmt.id}
                    className="flex flex-col gap-2 rounded-2xl border border-white/80 bg-white/30 px-4 py-3 shadow-[0_0_8px_rgba(255,255,255,0.5)] backdrop-blur-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-bold text-[#3A071F]">{cmt.authorName}</span>
                          <span aria-hidden="true" className="text-[#B65A7C]">
                            ·
                          </span>
                          <span className="text-[#6F1F3B]/70 tabular-nums">
                            {new Date(cmt.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                          {cmt.updatedAt && cmt.updatedAt !== cmt.createdAt && (
                            <span className="text-[11px] text-[#B65A7C]">(đã chỉnh sửa)</span>
                          )}
                        </div>

                        {!isEditing ? (
                          <p className="break-words text-sm text-[#3A071F]/90">{cmt.content}</p>
                        ) : (
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <input
                              type="text"
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              maxLength={500}
                              className="min-h-[40px] flex-1 rounded-xl border border-[#FDA4AF] bg-white px-3 py-1.5 text-sm text-[#3A071F] focus:outline-none"
                            />
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(cmt.id)}
                                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1 rounded-xl border border-[#FDA4AF] bg-[#FFE4E6] px-3 py-1.5 text-xs font-semibold text-[#9F1239] hover:bg-[#FECDD3]"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Lưu</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingText('');
                                }}
                                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1 rounded-xl border border-[#B65A7C]/35 bg-white px-3 py-1.5 text-xs font-semibold text-[#6F1F3B]"
                              >
                                <X className="h-3.5 w-3.5" />
                                <span>Hủy</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {!isEditing && (isOwner || canDelete) && (
                        <div className="flex shrink-0 items-center gap-1">
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(cmt.id);
                                setEditingText(cmt.content);
                              }}
                              aria-label="Sửa lời nhắn"
                              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#B65A7C] transition-colors hover:bg-[#E2A6BA]/30 hover:text-[#3A071F]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setPendingDeleteCommentId(cmt.id)}
                              aria-label="Xóa lời nhắn"
                              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#B65A7C] transition-colors hover:bg-[#E2A6BA]/30 hover:text-[#3A071F]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {comments.length > visibleCount && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    onPlayHoverSound();
                    setVisibleCount((prev) => prev + 10);
                  }}
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-white bg-white/20 px-6 py-2 text-xs font-bold text-[#5E1131] shadow-[0_0_12px_rgba(255,255,255,0.85)] backdrop-blur-sm transition-all hover:bg-white/35 hover:shadow-[0_0_16px_rgba(255,255,255,1)]"
                >
                  <ChevronDown className="h-4 w-4" />
                  <span>
                    Xem thêm ({Math.min(10, comments.length - visibleCount)} lời nhắn nữa)
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <ConfirmModal
        isOpen={pendingDeleteCommentId !== null}
        title="Xác nhận xoá lời nhắn"
        description="Bạn có chắc muốn xoá lời nhắn này không? Thao tác này không thể hoàn tác."
        loading={deletingComment}
        onConfirm={handleConfirmDeleteComment}
        onCancel={() => setPendingDeleteCommentId(null)}
      />
    </motion.div>
  );
};
