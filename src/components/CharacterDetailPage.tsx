import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Heart,
  Copy,
  MessageCircle,
  Send,
  Trash2,
  Pencil,
  Check,
  X,
  BookOpen,
  Eye,
} from 'lucide-react';
import { Character, CharacterComment, UserProfile } from '../types';
import { AvatarFrame } from './AvatarFrame';
import { Tilt3DCard } from './Tilt3DCard';
import { ConfirmModal } from './ConfirmModal';

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
  isLiked,
  currentUser,
  onBack,
  onToggleLike,
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
  const [copiedLink, setCopiedLink] = useState(false);

  const handleLikeClick = () => {
    if (!currentUser || !currentUser.emailVerified) {
      setAuthNotice('Bạn cần đăng nhập tài khoản đã xác minh để thả tim cho nhân vật.');
      onRequestAuth();
      return;
    }
    setAuthNotice(null);
    onToggleLike(character.id);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.emailVerified) {
      setAuthNotice('Bạn cần đăng nhập tài khoản đã xác minh để gửi bình luận.');
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

  const handleCopyLink = async () => {
    if (!safeHref) return;
    try {
      await navigator.clipboard.writeText(safeHref);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = safeHref;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    }
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <motion.div
      key={character.id}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-4xl px-4 pt-4 pb-24 sm:px-6"
    >
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          onPointerEnter={onPlayHoverSound}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-[#B65A7C]/30 bg-[#FFF0F5]/85 px-4 py-2 text-sm font-semibold text-[#6F1F3B] shadow-sm transition-all duration-200 hover:-translate-x-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-[#6F1F3B]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="whitespace-nowrap">Quay lại danh sách</span>
        </button>
      </div>

      {/* Main Dedicated Profile Card */}
      <div className="overflow-hidden rounded-3xl border border-[#B65A7C]/25 bg-[#FFF0F5]/88 p-6 shadow-[0_20px_50px_-18px_rgba(111,31,59,0.22)] backdrop-blur-md sm:p-10">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
          {/* Left: Framed Avatar + Stats + Heart Action */}
          <div className="flex shrink-0 flex-col items-center">
            <Tilt3DCard maxTilt={7} onHoverSound={onPlayHoverSound}>
              <div className="animate-float-3d group">
                <AvatarFrame src={character.avatar} alt={character.name} size="lg" />
              </div>
            </Tilt3DCard>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={handleLikeClick}
                className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F1F3B] ${
                  isLiked
                    ? 'bg-[#6F1F3B] text-[#FFF0F5] shadow-[0_8px_20px_-6px_rgba(111,31,59,0.6)]'
                    : 'border border-[#B65A7C]/35 bg-white/80 text-[#6F1F3B] hover:bg-[#E2A6BA]/30'
                }`}
              >
                <Heart className={`h-4 w-4 ${isLiked ? 'fill-[#FFF0F5] text-[#FFF0F5]' : ''}`} />
                <span className="tabular-nums">{character.likesCount} Tim</span>
              </button>

              <div className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#E2A6BA]/70 bg-white/70 px-4 py-2 text-sm font-semibold text-[#6F1F3B]">
                <Eye className="h-4 w-4 text-[#B65A7C]" />
                <span className="tabular-nums">{character.viewsCount}</span>
              </div>
            </div>
          </div>

          {/* Right: Name, Hashtags, Slogan, Story, Link */}
          <div className="min-w-0 flex-1 text-center md:text-left">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-semibold text-[#B65A7C] md:justify-start">
              {character.hashtags.map((tag, index) => (
                <React.Fragment key={tag}>
                  <span>#{tag.replace(/^#/, '')}</span>
                  {index < character.hashtags.length - 1 && (
                    <span aria-hidden="true" className="opacity-50">
                      ·
                    </span>
                  )}
                </React.Fragment>
              ))}
            </div>

            <h1
              className="font-cute mb-3 text-3xl font-bold tracking-tight text-[#3A071F] sm:text-4xl"
              style={{ textWrap: 'balance' }}
            >
              {character.name}
            </h1>

            <p className="mb-6 rounded-2xl border border-[#E2A6BA]/50 bg-white/60 px-5 py-3.5 text-base font-medium text-[#6F1F3B] italic">
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
                <div className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-gradient-to-r from-[#6F1F3B] to-[#3A071F] px-5 py-2 text-sm font-semibold text-[#FFF0F5] shadow-[0_10px_24px_-8px_rgba(111,31,59,0.55)]">
                  <span>Mua Kẹo</span>
                  <a
                    href={safeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onPointerEnter={onPlayHoverSound}
                    className="rounded-md bg-[#E2A6BA]/30 px-2.5 py-0.5 font-extrabold text-[#FFF0F5] underline decoration-[#FFF0F5] decoration-2 underline-offset-4 transition-colors hover:bg-[#FFF0F5] hover:text-[#3A071F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFF0F5]"
                  >
                    Ở Đây
                  </a>
                </div>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  onPointerEnter={onPlayHoverSound}
                  aria-label="Copy link mua kẹo"
                  className="inline-flex min-h-[46px] cursor-pointer items-center gap-1.5 rounded-full border border-[#B65A7C]/35 bg-white/85 px-4 py-2 text-xs font-bold text-[#6F1F3B] shadow-sm transition-colors hover:bg-[#E2A6BA]/30 hover:text-[#3A071F]"
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-4 w-4 text-[#6F1F3B]" />
                      <span>Đã copy link</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-[#B65A7C]" />
                      <span>Copy link</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <section className="mt-8 rounded-3xl border border-[#B65A7C]/20 bg-[#FFF0F5]/88 p-6 shadow-sm backdrop-blur-md sm:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-cute flex items-center gap-2 text-xl font-bold text-[#3A071F]">
            <MessageCircle className="h-5 w-5 text-[#B65A7C]" />
            <span>Bình luận ({comments.length})</span>
          </h2>
          {!currentUser ? (
            <button
              type="button"
              onClick={onRequestAuth}
              className="cursor-pointer text-xs font-semibold text-[#6F1F3B] underline decoration-[#B65A7C] underline-offset-4 hover:text-[#3A071F]"
            >
              Đăng nhập để bình luận &amp; thả tim
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
              Tài khoản {currentUser.email} chưa xác minh Gmail nên chưa thể thả tim hoặc bình luận.
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
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            maxLength={500}
            placeholder={
              currentUser
                ? `Viết cảm nhận của ${currentUser.name} về ${character.name}...`
                : 'Đăng nhập để chia sẻ cảm nghĩ của bạn...'
            }
            className="min-h-[44px] flex-1 rounded-2xl border border-[#B65A7C]/30 bg-white/85 px-4 py-2.5 text-sm text-[#3A071F] placeholder-[#B65A7C]/70 focus:border-[#6F1F3B] focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#6F1F3B] px-5 py-2.5 text-sm font-semibold text-[#FFF0F5] transition-colors hover:bg-[#3A071F] disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            <span className="whitespace-nowrap">Gửi bình luận</span>
          </button>
        </form>

        {comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#6F1F3B]/75">
            Chưa có bình luận nào. Hãy là người đầu tiên gửi lời nhắn cho {character.name}!
          </p>
        ) : (
          <ul className="space-y-3">
            {comments.map((cmt) => {
              const isOwner = currentUser?.uid === cmt.authorUid;
              const canDelete = Boolean(
                currentUser && (currentUser.role === 'admin' || isOwner)
              );
              const isEditing = editingId === cmt.id;

              return (
                <li
                  key={cmt.id}
                  className="flex flex-col gap-2 rounded-2xl border border-[#E2A6BA]/40 bg-white/75 px-4 py-3"
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
                            className="min-h-[40px] flex-1 rounded-xl border border-[#6F1F3B]/40 bg-white px-3 py-1.5 text-sm text-[#3A071F] focus:outline-none"
                          />
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(cmt.id)}
                              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1 rounded-xl bg-[#6F1F3B] px-3 py-1.5 text-xs font-semibold text-[#FFF0F5] hover:bg-[#3A071F]"
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
                            aria-label="Sửa bình luận"
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#B65A7C] transition-colors hover:bg-[#E2A6BA]/30 hover:text-[#3A071F]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setPendingDeleteCommentId(cmt.id)}
                            aria-label="Xóa bình luận"
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
        )}
      </section>

      <ConfirmModal
        isOpen={pendingDeleteCommentId !== null}
        title="Xác nhận xoá bình luận"
        description="Bạn có chắc muốn xoá bình luận này không? Thao tác này không thể hoàn tác."
        loading={deletingComment}
        onConfirm={handleConfirmDeleteComment}
        onCancel={() => setPendingDeleteCommentId(null)}
      />
    </motion.div>
  );
};
