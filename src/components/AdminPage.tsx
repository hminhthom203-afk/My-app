import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  Pencil,
  Trash2,
  Music,
  Upload,
  Sparkles,
  Bell,
  Heart,
  MessageCircle,
  X,
  Link2,
  UserPlus,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import { AdminNotification, Character, MusicTrack } from '../types';
import {
  compressImageFile,
  normalizeMediaUrl,
  readAndChunkAudioFile,
  stripFileExtension,
} from '../utils/mediaHelpers';
import { AvatarFrame } from './AvatarFrame';
import { ConfirmModal } from './ConfirmModal';

type AdminTab = 'add_char' | 'edit_char' | 'music' | 'notifications';

type PendingDelete =
  | { kind: 'character'; id: string; label: string }
  | { kind: 'track'; id: string; label: string }
  | { kind: 'all_tracks'; count: number }
  | { kind: 'notification'; id: string }
  | { kind: 'all_notifications'; count: number }
  | null;

interface CharacterFormInput {
  id?: string;
  name: string;
  avatar: string;
  hashtags: string[];
  slogan: string;
  story: string;
  link: string;
  linkLabel: string;
  passcode?: string;
  passcodeHint?: string;
}

interface TrackFormInput {
  id?: string;
  title: string;
  artist: string;
  mood: string;
  durationLabel: string;
  audioUrl: string;
  synthPreset: MusicTrack['synthPreset'];
  pendingAudioFile?: { base64Chunks: string[]; mimeType: string };
  onProgress?: (percent: number) => void;
}

interface AdminPageProps {
  characters: Character[];
  tracks: MusicTrack[];
  notifications: AdminNotification[];
  onSaveCharacter: (input: CharacterFormInput) => Promise<void>;
  onDeleteCharacter: (id: string) => Promise<void>;
  onSaveTrack: (input: TrackFormInput) => Promise<void>;
  onDeleteTrack: (id: string) => Promise<void>;
  onDeleteAllTracks: () => Promise<void>;
  onMarkAllNotificationsRead: () => Promise<void>;
  onDeleteNotification: (id: string) => Promise<void>;
  onDeleteAllNotifications: () => Promise<void>;
  onSeedDefaults: () => Promise<void>;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  characters,
  tracks,
  notifications,
  onSaveCharacter,
  onDeleteCharacter,
  onSaveTrack,
  onDeleteTrack,
  onDeleteAllTracks,
  onMarkAllNotificationsRead,
  onDeleteNotification,
  onDeleteAllNotifications,
  onSeedDefaults,
}) => {
  const [tab, setTab] = useState<AdminTab>('edit_char');
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [deleting, setDeleting] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (tab === 'notifications' && unreadCount > 0) {
      void onMarkAllNotificationsRead();
    }
  }, [tab, unreadCount, onMarkAllNotificationsRead]);

  // Character form state
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [charName, setCharName] = useState('');
  const [charAvatar, setCharAvatar] = useState('');
  const [charHashtags, setCharHashtags] = useState('');
  const [charSlogan, setCharSlogan] = useState('');
  const [charStory, setCharStory] = useState('');
  const [charLink, setCharLink] = useState('');
  const [charPasscode, setCharPasscode] = useState('');
  const [charPasscodeHint, setCharPasscodeHint] = useState('');
  const [readingAvatar, setReadingAvatar] = useState(false);
  const [charError, setCharError] = useState<string | null>(null);

  // Track form state
  const trackFormRef = useRef<HTMLFormElement | null>(null);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [pendingAudioFile, setPendingAudioFile] = useState<{
    base64Chunks: string[];
    mimeType: string;
    fileName: string;
    sizeBytes: number;
  } | null>(null);
  const [existingChunksUrl, setExistingChunksUrl] = useState<string>('');
  const [readingAudio, setReadingAudio] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  const resetCharForm = () => {
    setEditingCharId(null);
    setCharName('');
    setCharAvatar('');
    setCharHashtags('');
    setCharSlogan('');
    setCharStory('');
    setCharLink('');
    setCharPasscode('');
    setCharPasscodeHint('');
    setCharError(null);
  };

  const handleOpenAddChar = () => {
    resetCharForm();
    setTab('add_char');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEditCharTab = () => {
    resetCharForm();
    setTab('edit_char');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditChar = (c: Character) => {
    setEditingCharId(c.id);
    setCharName(c.name);
    setCharAvatar(c.avatar);
    setCharHashtags(c.hashtags.join(', '));
    setCharSlogan(c.slogan);
    setCharStory(c.story);
    setCharLink(c.link);
    setCharPasscode(c.passcode || '');
    setCharPasscodeHint(c.passcodeHint || '');
    setCharError(null);
    setTab('edit_char');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCharError(null);
    setReadingAvatar(true);
    try {
      const dataUrl = await compressImageFile(file);
      setCharAvatar(dataUrl);
    } catch (err) {
      setCharError(err instanceof Error ? err.message : 'Không thể đọc tệp ảnh này.');
    } finally {
      setReadingAvatar(false);
    }
  };

  const handleCharSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || readingAvatar) return;
    setCharError(null);

    if (!charAvatar.trim()) {
      setCharError('Vui lòng chọn ảnh nhân vật từ máy hoặc dán link ảnh / Google Drive.');
      return;
    }
    if (!charName.trim() || !charSlogan.trim()) {
      setCharError('Vui lòng nhập đầy đủ Tên nhân vật và Slogan.');
      return;
    }

    const parsedTags = charHashtags
      .split(',')
      .map((t) => t.trim().replace(/^#/, '').slice(0, 40))
      .filter(Boolean)
      .slice(0, 10);

    setSaving(true);
    try {
      await onSaveCharacter({
        id: editingCharId || undefined,
        name: charName.trim().slice(0, 80),
        avatar: normalizeMediaUrl(charAvatar, 'image').slice(0, 200000),
        hashtags: parsedTags,
        slogan: charSlogan.trim().slice(0, 200),
        story:
          charStory.trim().slice(0, 5000) ||
          'Câu chuyện đang được viết tiếp tại khu vườn Ăn Kẹo Hong.',
        link: charLink.trim().slice(0, 500),
        linkLabel: 'Mua Kẹo Ở Đây',
        passcode: charPasscode.trim().slice(0, 80),
        passcodeHint: charPasscodeHint.trim().slice(0, 200),
      });
      resetCharForm();
      setTab('edit_char');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setCharError('Không thể lưu nhân vật. Hãy kiểm tra lại ảnh hoặc link hợp lệ.');
    } finally {
      setSaving(false);
    }
  };

  const resetTrackForm = () => {
    setEditingTrackId(null);
    setTrackTitle('');
    setTrackArtist('');
    setTrackUrl('');
    setPendingAudioFile(null);
    setExistingChunksUrl('');
    setTrackError(null);
    setUploadProgress(null);
  };

  const handleEditTrack = (t: MusicTrack) => {
    setEditingTrackId(t.id);
    setTrackTitle(t.title);
    setTrackArtist(t.artist || '');
    if (t.audioUrl && t.audioUrl.startsWith('chunks:')) {
      setExistingChunksUrl(t.audioUrl);
      setTrackUrl('');
    } else {
      setExistingChunksUrl('');
      setTrackUrl(t.audioUrl || '');
    }
    setPendingAudioFile(null);
    setTrackError(null);
    setUploadProgress(null);
    setTimeout(() => {
      if (trackFormRef.current) {
        trackFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 30);
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setTrackError(null);
    setReadingAudio(true);
    try {
      const processed = await readAndChunkAudioFile(file);
      setPendingAudioFile(processed);
      setExistingChunksUrl('');
      setTrackUrl('');
      setTrackTitle((prev) => (prev.trim() ? prev : stripFileExtension(file.name).slice(0, 100)));
    } catch (err) {
      setTrackError(err instanceof Error ? err.message : 'Không thể đọc tệp nhạc này.');
    } finally {
      setReadingAudio(false);
    }
  };

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackTitle.trim() || saving || readingAudio) return;
    setTrackError(null);
    setSaving(true);
    setUploadProgress(pendingAudioFile ? 0 : null);
    try {
      const hasAudioSource =
        Boolean(pendingAudioFile) || Boolean(existingChunksUrl) || Boolean(trackUrl.trim());
      await onSaveTrack({
        id: editingTrackId || undefined,
        title: trackTitle.trim().slice(0, 100),
        artist: trackArtist.trim().slice(0, 100),
        mood: 'Nhạc nền',
        durationLabel: hasAudioSource ? 'Nhạc đã tải' : 'Vòng lặp êm ái',
        audioUrl: pendingAudioFile
          ? ''
          : existingChunksUrl || normalizeMediaUrl(trackUrl, 'audio').slice(0, 500),
        synthPreset: 'rose_waltz',
        pendingAudioFile: pendingAudioFile
          ? {
              base64Chunks: pendingAudioFile.base64Chunks,
              mimeType: pendingAudioFile.mimeType,
            }
          : undefined,
        onProgress: (percent) => setUploadProgress(percent),
      });
      resetTrackForm();
    } catch {
      setTrackError('Không thể lưu bài nhạc. Hãy kiểm tra lại tệp hoặc link nhạc.');
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === 'character') {
        await onDeleteCharacter(pendingDelete.id);
        if (editingCharId === pendingDelete.id) resetCharForm();
      } else if (pendingDelete.kind === 'track') {
        await onDeleteTrack(pendingDelete.id);
        if (editingTrackId === pendingDelete.id) resetTrackForm();
      } else if (pendingDelete.kind === 'all_tracks') {
        await onDeleteAllTracks();
        resetTrackForm();
      } else if (pendingDelete.kind === 'notification') {
        await onDeleteNotification(pendingDelete.id);
      } else if (pendingDelete.kind === 'all_notifications') {
        await onDeleteAllNotifications();
      }
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const confirmDialogCopy = (() => {
    if (!pendingDelete) return { title: '', description: '' };
    if (pendingDelete.kind === 'character') {
      return {
        title: 'Xác nhận xoá nhân vật',
        description: `Bạn có chắc muốn xoá nhân vật "${pendingDelete.label}"? Sau khi xoá sẽ không tự hiện lại.`,
      };
    }
    if (pendingDelete.kind === 'track') {
      return {
        title: 'Xác nhận xoá bài nhạc',
        description: `Bạn có chắc muốn xoá bài nhạc "${pendingDelete.label}" khỏi danh sách?`,
      };
    }
    if (pendingDelete.kind === 'all_tracks') {
      return {
        title: 'Xác nhận xoá toàn bộ nhạc',
        description: `Bạn có chắc muốn xoá tất cả ${pendingDelete.count} bài nhạc hiện có trên Firebase?`,
      };
    }
    if (pendingDelete.kind === 'all_notifications') {
      return {
        title: 'Xác nhận xoá toàn bộ thông báo',
        description: `Bạn có chắc muốn xoá tất cả ${pendingDelete.count} thông báo khỏi hộp thư quản trị?`,
      };
    }
    return {
      title: 'Xác nhận xoá thông báo',
      description: 'Bạn có chắc muốn xoá thông báo này khỏi hộp thư quản trị?',
    };
  })();

  const renderCharacterForm = (isEditMode: boolean) => (
    <div className="mx-auto w-full max-w-2xl">
      {isEditMode && (
        <button
          type="button"
          onClick={handleOpenEditCharTab}
          className="mb-4 inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-[#B65A7C]/30 bg-white/90 px-4 py-1.5 text-xs font-semibold text-[#6F1F3B] hover:bg-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Quay lại danh sách Sửa nhân vật</span>
        </button>
      )}

      <form
        onSubmit={handleCharSubmit}
        className="space-y-4 rounded-3xl border border-[#B65A7C]/25 bg-[#FFF0F5]/92 p-6 shadow-sm sm:p-8"
      >
        <h2 className="font-cute text-xl font-bold text-[#3A071F]">
          {isEditMode ? 'Chỉnh sửa nhân vật' : 'Thêm nhân vật mới'}
        </h2>

        <div className="flex flex-wrap items-center gap-4">
          <AvatarFrame
            src={normalizeMediaUrl(charAvatar, 'image')}
            alt={charName || 'Chưa chọn ảnh'}
            size="md"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-[#B65A7C]/35 bg-white px-4 py-1.5 text-xs font-semibold text-[#6F1F3B] hover:bg-[#E2A6BA]/25">
                <Upload className="h-3.5 w-3.5" />
                <span>{readingAvatar ? 'Đang tải ảnh...' : 'Chọn ảnh từ máy'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={readingAvatar}
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
              {charAvatar && (
                <button
                  type="button"
                  onClick={() => setCharAvatar('')}
                  className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-full border border-[#B65A7C]/25 bg-white px-3 py-1 text-[11px] font-semibold text-[#B65A7C] hover:text-[#3A071F]"
                >
                  <X className="h-3 w-3" />
                  <span>Xoá ảnh</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-[#6F1F3B]/75">
              Tự chọn tệp ảnh từ máy/Drive hoặc dán link bên dưới.
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">
            Hoặc dán link ảnh / Google Drive *
          </label>
          <input
            type="text"
            value={charAvatar.startsWith('data:') ? '' : charAvatar}
            onChange={(e) => {
              setCharError(null);
              setCharAvatar(e.target.value);
            }}
            placeholder={
              charAvatar.startsWith('data:')
                ? 'Đang dùng ảnh tải lên từ máy (dán link mới để thay)'
                : 'https://drive.google.com/file/d/... hoặc link ảnh'
            }
            className="min-h-[42px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-[#B65A7C]">
            Link Google Drive cần bật chia sẻ: Bất kỳ ai có đường liên kết.
          </p>
        </div>

        {charError && (
          <p className="rounded-xl border border-[#6F1F3B]/30 bg-white px-3 py-2 text-xs font-semibold text-[#6F1F3B]">
            {charError}
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">
            Tên nhân vật *
          </label>
          <input
            type="text"
            required
            maxLength={80}
            value={charName}
            onChange={(e) => setCharName(e.target.value)}
            className="min-h-[42px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">
            Hashtag (cách nhau bởi dấu phẩy)
          </label>
          <input
            type="text"
            value={charHashtags}
            onChange={(e) => setCharHashtags(e.target.value)}
            placeholder="Nhập hashtag (cách nhau bởi dấu phẩy)..."
            className="min-h-[42px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">Slogan *</label>
          <input
            type="text"
            required
            maxLength={200}
            value={charSlogan}
            onChange={(e) => setCharSlogan(e.target.value)}
            className="min-h-[42px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">
            Cốt truyện
          </label>
          <textarea
            rows={5}
            maxLength={5000}
            value={charStory}
            onChange={(e) => setCharStory(e.target.value)}
            className="w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">
            Link mua kẹo (gắn vào chữ Ở Đây)
          </label>
          <input
            type="text"
            maxLength={500}
            value={charLink}
            onChange={(e) => setCharLink(e.target.value)}
            placeholder="https://..."
            className="min-h-[42px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-[#DDD6FE] bg-[#EDE9FE]/55 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#5B21B6]">
            <Lock className="h-3.5 w-3.5" />
            <span>Khoá Link Bằng Pass (tuỳ chọn)</span>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#5B21B6]">
              Mật khẩu mở link (để trống nếu không đặt pass)
            </label>
            <input
              type="text"
              maxLength={80}
              value={charPasscode}
              onChange={(e) => setCharPasscode(e.target.value)}
              placeholder="Ví dụ: keo2026..."
              className="min-h-[42px] w-full rounded-xl border border-[#DDD6FE] bg-white px-3 py-2 text-sm text-[#4C1D95] focus:border-[#A78BFA] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#5B21B6]">
              Gợi ý pass (hiển thị phía trên ô nhập pass cho người xem)
            </label>
            <input
              type="text"
              maxLength={200}
              value={charPasscodeHint}
              onChange={(e) => setCharPasscodeHint(e.target.value)}
              placeholder="Ví dụ: Ngày sinh của bé kẹo..."
              className="min-h-[42px] w-full rounded-xl border border-[#DDD6FE] bg-white px-3 py-2 text-sm text-[#4C1D95] focus:border-[#A78BFA] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={saving || readingAvatar}
            className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#6F1F3B] px-5 py-2 text-sm font-bold text-[#FFF0F5] hover:bg-[#3A071F] disabled:opacity-60"
          >
            {isEditMode ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span>
              {saving ? 'Đang lưu...' : isEditMode ? 'Lưu cập nhật' : 'Thêm nhân vật'}
            </span>
          </button>
          {isEditMode && (
            <button
              type="button"
              onClick={handleOpenEditCharTab}
              className="min-h-[44px] cursor-pointer rounded-full border border-[#B65A7C]/35 px-5 py-2 text-xs font-semibold text-[#6F1F3B] hover:bg-white"
            >
              Hủy
            </button>
          )}
        </div>
      </form>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="mx-auto w-full max-w-5xl px-4 pb-28 sm:px-6"
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#B65A7C] uppercase">
            Khu Vực Quản Trị
          </p>
          <h1 className="font-cute text-2xl font-bold text-[#3A071F] sm:text-3xl">
            Quản Lý Nhân Vật &amp; Âm Nhạc
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {characters.length === 0 && (
            <button
              type="button"
              onClick={onSeedDefaults}
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-[#6F1F3B]/35 bg-white px-4 py-1.5 text-xs font-bold text-[#6F1F3B] hover:bg-[#E2A6BA]/30"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Nạp nhân vật mẫu lên Firebase</span>
            </button>
          )}

          {/* 4 Main Admin Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-[#B65A7C]/25 bg-[#FFF0F5]/80 p-1">
            <button
              type="button"
              onClick={handleOpenAddChar}
              className={`inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'add_char'
                  ? 'bg-[#6F1F3B] text-[#FFF0F5]'
                  : 'text-[#6F1F3B] hover:bg-[#E2A6BA]/30'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Thêm nhân vật</span>
            </button>

            <button
              type="button"
              onClick={handleOpenEditCharTab}
              className={`inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'edit_char'
                  ? 'bg-[#6F1F3B] text-[#FFF0F5]'
                  : 'text-[#6F1F3B] hover:bg-[#E2A6BA]/30'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Sửa nhân vật ({characters.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('music')}
              className={`inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'music'
                  ? 'bg-[#6F1F3B] text-[#FFF0F5]'
                  : 'text-[#6F1F3B] hover:bg-[#E2A6BA]/30'
              }`}
            >
              <Music className="h-3.5 w-3.5" />
              <span>Âm nhạc ({tracks.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('notifications');
                void onMarkAllNotificationsRead();
              }}
              className={`inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'notifications'
                  ? 'bg-[#6F1F3B] text-[#FFF0F5]'
                  : 'text-[#6F1F3B] hover:bg-[#E2A6BA]/30'
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              <span>
                {unreadCount > 0 ? `Thông báo (${unreadCount} mới)` : 'Thông báo'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* PAGE 1: ADD CHARACTER (Dedicated View) */}
      {tab === 'add_char' && renderCharacterForm(false)}

      {/* PAGE 2: EDIT / MANAGE CHARACTERS (List or Dedicated Edit View) */}
      {tab === 'edit_char' && (
        editingCharId ? (
          renderCharacterForm(true)
        ) : characters.length === 0 ? (
          <div className="rounded-3xl border border-[#B65A7C]/20 bg-[#FFF0F5]/85 p-10 text-center">
            <p className="font-cute text-lg font-bold text-[#3A071F]">
              Chưa có nhân vật nào
            </p>
            <p className="mt-1 text-xs text-[#6F1F3B]/80">
              Hãy bấm nút “Thêm nhân vật” để tạo nhân vật đầu tiên của bạn.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {characters.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-[#B65A7C]/20 bg-[#FFF0F5]/85 p-4 shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="h-16 w-16 shrink-0 aspect-square overflow-hidden rounded-xl">
                    <AvatarFrame src={c.avatar} alt={c.name} size="sm" className="h-full w-full object-cover shrink-0 aspect-square" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-cute flex items-center gap-1.5 truncate text-base font-bold text-[#3A071F]">
                      <span className="truncate">{c.name}</span>
                      {Boolean(c.passcode?.trim()) && (
                        <span
                          title="Nhân vật có mật khẩu mở link"
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#EDE9FE] text-[#5B21B6]"
                        >
                          <Lock className="h-3 w-3" />
                        </span>
                      )}
                    </h3>
                    <p className="truncate text-xs text-[#6F1F3B]/80">{c.slogan}</p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-[#B65A7C] tabular-nums">
                      {c.likesCount} tim · {c.viewsCount} lượt xem
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleEditChar(c)}
                    aria-label={`Sửa ${c.name}`}
                    className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-[#E2A6BA] bg-white px-3 py-1.5 text-xs font-semibold text-[#6F1F3B] hover:bg-[#E2A6BA]/30"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Sửa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingDelete({ kind: 'character', id: c.id, label: c.name })
                    }
                    aria-label={`Xóa ${c.name}`}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#E2A6BA] bg-white text-[#6F1F3B] hover:bg-[#3A071F] hover:text-[#FFF0F5]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* PAGE 3: MUSIC */}
      {tab === 'music' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <form
            ref={trackFormRef}
            onSubmit={handleTrackSubmit}
            className="scroll-mt-4 space-y-4 rounded-3xl border border-[#B65A7C]/25 bg-[#FFF0F5]/90 p-6 shadow-sm lg:col-span-5"
          >
            <h2 className="font-cute text-lg font-bold text-[#3A071F]">
              {editingTrackId ? 'Chỉnh sửa bài nhạc' : 'Thêm nhạc mới'}
            </h2>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">
                Tên bài hát * (bạn tự đặt tuỳ ý, không bắt buộc giống link)
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={trackTitle}
                onChange={(e) => setTrackTitle(e.target.value)}
                placeholder="Nhập tên bài hát bạn muốn hiển thị..."
                className="min-h-[42px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">Nghệ sĩ</label>
              <input
                type="text"
                maxLength={100}
                value={trackArtist}
                onChange={(e) => setTrackArtist(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
              />
            </div>

            <div className="space-y-2 rounded-2xl border border-[#B65A7C]/20 bg-white/75 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#6F1F3B]">
                  Nhạc từ máy (tối đa 50 MB)
                </span>
                <label className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-[#B65A7C]/35 bg-white px-3.5 py-1 text-xs font-semibold text-[#6F1F3B] hover:bg-[#E2A6BA]/25">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{readingAudio ? 'Đang xử lý...' : 'Chọn nhạc từ máy'}</span>
                  <input
                    type="file"
                    accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac"
                    onChange={handleAudioFileUpload}
                    disabled={readingAudio}
                    className="hidden"
                  />
                </label>
              </div>

              {pendingAudioFile && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-[#E2A6BA]/25 px-3 py-2 text-xs text-[#3A071F]">
                  <span className="truncate font-semibold">
                    {pendingAudioFile.fileName} (
                    {(pendingAudioFile.sizeBytes / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingAudioFile(null)}
                    className="shrink-0 cursor-pointer font-bold text-[#6F1F3B] hover:underline"
                  >
                    Gỡ tệp
                  </button>
                </div>
              )}

              {!pendingAudioFile && existingChunksUrl && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-[#E2A6BA]/25 px-3 py-2 text-xs text-[#3A071F]">
                  <span className="truncate font-semibold">
                    Đang dùng tệp nhạc đã tải lên máy chủ
                  </span>
                  <button
                    type="button"
                    onClick={() => setExistingChunksUrl('')}
                    className="shrink-0 cursor-pointer font-bold text-[#6F1F3B] hover:underline"
                  >
                    Gỡ tệp
                  </button>
                </div>
              )}

              <div>
                <label className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-[#6F1F3B]">
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Hoặc dán link nhạc (MP3 / Google Drive)</span>
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={trackUrl}
                  onChange={(e) => {
                    setTrackError(null);
                    setPendingAudioFile(null);
                    setExistingChunksUrl('');
                    setTrackUrl(e.target.value);
                  }}
                  placeholder="https://drive.google.com/file/d/... hoặc link .mp3"
                  className="min-h-[42px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-[#B65A7C]">
                  Link Google Drive cần bật chia sẻ: Bất kỳ ai có đường liên kết.
                </p>
              </div>
            </div>

            {trackError && (
              <p className="rounded-xl border border-[#6F1F3B]/30 bg-white px-3 py-2 text-xs font-semibold text-[#6F1F3B]">
                {trackError}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={saving || readingAudio}
                className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#6F1F3B] px-5 py-2 text-sm font-bold text-[#FFF0F5] hover:bg-[#3A071F] disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                <span>
                  {saving
                    ? uploadProgress !== null
                      ? `Đang tải lên... ${uploadProgress}%`
                      : 'Đang lưu...'
                    : editingTrackId
                      ? 'Lưu bài hát'
                      : 'Thêm bài hát'}
                </span>
              </button>
              {editingTrackId && (
                <button
                  type="button"
                  onClick={resetTrackForm}
                  className="min-h-[44px] cursor-pointer rounded-full border border-[#B65A7C]/35 px-4 py-2 text-xs font-semibold text-[#6F1F3B] hover:bg-white"
                >
                  Hủy
                </button>
              )}
            </div>
          </form>

          <div className="space-y-3 lg:col-span-7">
            {tracks.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setPendingDelete({ kind: 'all_tracks', count: tracks.length })
                  }
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-[#6F1F3B]/35 bg-white px-4 py-1.5 text-xs font-bold text-[#6F1F3B] hover:bg-[#3A071F] hover:text-[#FFF0F5]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Xoá tất cả nhạc</span>
                </button>
              </div>
            )}

            {tracks.length === 0 ? (
              <div className="rounded-2xl border border-[#B65A7C]/20 bg-[#FFF0F5]/85 p-8 text-center text-sm text-[#6F1F3B]">
                Chưa có bài nhạc nào trên Firebase. Bạn hãy tự thêm nhạc ở biểu mẫu bên cạnh nhé!
              </div>
            ) : (
              tracks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-[#B65A7C]/20 bg-[#FFF0F5]/85 p-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <h3 className="font-cute truncate text-base font-bold text-[#3A071F]">
                      {t.title}
                    </h3>
                    {Boolean(t.artist && t.artist.trim()) && (
                      <p className="truncate text-xs text-[#6F1F3B]/80">{t.artist}</p>
                    )}
                    {t.audioUrl && (
                      <p className="mt-0.5 truncate text-[11px] text-[#B65A7C]">
                        {t.audioUrl.startsWith('chunks:')
                          ? 'Tệp nhạc tải lên từ máy'
                          : t.audioUrl.startsWith('/api/drive-media')
                            ? 'Link Google Drive'
                            : t.audioUrl}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEditTrack(t)}
                      aria-label={`Sửa ${t.title}`}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#E2A6BA] bg-white text-[#6F1F3B] hover:bg-[#E2A6BA]/30"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingDelete({ kind: 'track', id: t.id, label: t.title })
                      }
                      aria-label={`Xóa ${t.title}`}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#E2A6BA] bg-white text-[#6F1F3B] hover:bg-[#3A071F] hover:text-[#FFF0F5]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* PAGE 4: NOTIFICATIONS */}
      {tab === 'notifications' && (
        <div className="space-y-3 rounded-3xl border border-[#B65A7C]/25 bg-[#FFF0F5]/90 p-6 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-cute text-lg font-bold text-[#3A071F]">
              Hộp thư thông báo
            </h2>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setPendingDelete({
                    kind: 'all_notifications',
                    count: notifications.length,
                  })
                }
                className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-[#6F1F3B]/35 bg-white px-3.5 py-1 text-xs font-bold text-[#6F1F3B] hover:bg-[#3A071F] hover:text-[#FFF0F5]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xoá tất cả</span>
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#6F1F3B]/75">
              Chưa có thông báo mới nào.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 ${
                    n.read
                      ? 'border-[#E2A6BA]/45 bg-white/70'
                      : 'border-[#6F1F3B]/40 bg-white shadow-sm'
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E2A6BA]/35 text-[#6F1F3B]">
                      {n.type === 'like' ? (
                        <Heart className="h-4 w-4" />
                      ) : (
                        <MessageCircle className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#3A071F]">
                        {n.actorName}{' '}
                        {n.type === 'like' ? 'đã thả tim cho' : 'đã bình luận về'}{' '}
                        <span className="text-[#6F1F3B]">{n.characterName}</span>
                      </p>
                      <p className="mt-0.5 break-words text-xs text-[#3A071F]/85">
                        {n.message}
                      </p>
                      <p className="mt-1 text-[11px] text-[#B65A7C] tabular-nums">
                        {new Date(n.createdAt).toLocaleString('vi-VN')} · Gmail:{' '}
                        {n.emailStatus === 'sent'
                          ? 'Đã gửi email'
                          : 'Đã lưu hộp thư quản trị'}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPendingDelete({ kind: 'notification', id: n.id })}
                      aria-label="Xóa thông báo"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#B65A7C] hover:bg-[#E2A6BA]/30 hover:text-[#3A071F]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={pendingDelete !== null}
        title={confirmDialogCopy.title}
        description={confirmDialogCopy.description}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </motion.div>
  );
};
