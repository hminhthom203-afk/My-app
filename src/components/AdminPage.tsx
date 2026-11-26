import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  Pencil,
  Trash2,
  Music,
  Users,
  Upload,
  Sparkles,
  Bell,
  Check,
  Heart,
  MessageCircle,
} from 'lucide-react';
import { AdminNotification, Character, MusicTrack } from '../types';
import { PRESET_AVATARS } from '../data/initialData';
import { AvatarFrame } from './AvatarFrame';
import { ConfirmModal } from './ConfirmModal';

type PendingDelete =
  | { kind: 'character'; id: string; label: string }
  | { kind: 'track'; id: string; label: string }
  | { kind: 'all_tracks'; count: number }
  | { kind: 'notification'; id: string }
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
}

interface TrackFormInput {
  id?: string;
  title: string;
  artist: string;
  mood: string;
  durationLabel: string;
  audioUrl: string;
  synthPreset: MusicTrack['synthPreset'];
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
  onMarkNotificationRead: (id: string) => Promise<void>;
  onMarkAllNotificationsRead: () => Promise<void>;
  onDeleteNotification: (id: string) => Promise<void>;
  onSeedDefaults: () => Promise<void>;
}

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được ảnh'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Ảnh không hợp lệ'));
      img.onload = () => {
        const maxDim = 420;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas error'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
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
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDeleteNotification,
  onSeedDefaults,
}) => {
  const [tab, setTab] = useState<'chars' | 'music' | 'notifications'>('chars');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [deleting, setDeleting] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Character form state
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [charName, setCharName] = useState('');
  const [charAvatar, setCharAvatar] = useState(PRESET_AVATARS[0].url);
  const [charHashtags, setCharHashtags] = useState('hoahong, keongot');
  const [charSlogan, setCharSlogan] = useState('');
  const [charStory, setCharStory] = useState('');
  const [charLink, setCharLink] = useState('');

  // Track form state
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('Hộp Nhạc Của Kẹo');
  const [trackMood, setTrackMood] = useState('Dịu dàng · Huyền ảo');
  const [trackUrl, setTrackUrl] = useState('');
  const [trackPreset, setTrackPreset] =
    useState<MusicTrack['synthPreset']>('rose_waltz');

  const resetCharForm = () => {
    setEditingCharId(null);
    setCharName('');
    setCharAvatar(PRESET_AVATARS[0].url);
    setCharHashtags('hoahong, keongot');
    setCharSlogan('');
    setCharStory('');
    setCharLink('');
  };

  const handleEditChar = (c: Character) => {
    setEditingCharId(c.id);
    setCharName(c.name);
    setCharAvatar(c.avatar);
    setCharHashtags(c.hashtags.join(', '));
    setCharSlogan(c.slogan);
    setCharStory(c.story);
    setCharLink(c.link);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      setCharAvatar(dataUrl);
    } catch {
      // ignore invalid file
    }
  };

  const handleCharSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim() || !charSlogan.trim() || saving) return;

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
        avatar: charAvatar.trim().slice(0, 200000) || PRESET_AVATARS[0].url,
        hashtags: parsedTags.length > 0 ? parsedTags : ['ankeohong'],
        slogan: charSlogan.trim().slice(0, 200),
        story:
          charStory.trim().slice(0, 5000) ||
          'Câu chuyện đang được viết tiếp tại khu vườn Ăn Kẹo Hong.',
        link: charLink.trim().slice(0, 500),
        linkLabel: 'Mua Kẹo Ở Đây',
      });
      resetCharForm();
    } finally {
      setSaving(false);
    }
  };

  const resetTrackForm = () => {
    setEditingTrackId(null);
    setTrackTitle('');
    setTrackArtist('Hộp Nhạc Của Kẹo');
    setTrackMood('Dịu dàng · Huyền ảo');
    setTrackUrl('');
    setTrackPreset('rose_waltz');
  };

  const handleEditTrack = (t: MusicTrack) => {
    setEditingTrackId(t.id);
    setTrackTitle(t.title);
    setTrackArtist(t.artist);
    setTrackMood(t.mood);
    setTrackUrl(t.audioUrl || '');
    setTrackPreset(t.synthPreset || 'rose_waltz');
  };

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackTitle.trim() || saving) return;
    setSaving(true);
    try {
      await onSaveTrack({
        id: editingTrackId || undefined,
        title: trackTitle.trim().slice(0, 100),
        artist: trackArtist.trim().slice(0, 100) || 'Hộp Nhạc Của Kẹo',
        mood: trackMood.trim().slice(0, 100) || 'Êm ái',
        durationLabel: trackUrl.trim() ? 'Nhạc tải lên' : 'Vòng lặp êm ái',
        audioUrl: trackUrl.trim().slice(0, 500),
        synthPreset: trackPreset,
      });
      resetTrackForm();
    } finally {
      setSaving(false);
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
    return {
      title: 'Xác nhận xoá thông báo',
      description: 'Bạn có chắc muốn xoá thông báo này khỏi hộp thư quản trị?',
    };
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 sm:px-6"
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

          <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-[#B65A7C]/25 bg-[#FFF0F5]/80 p-1">
            <button
              type="button"
              onClick={() => setTab('chars')}
              className={`inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === 'chars'
                  ? 'bg-[#6F1F3B] text-[#FFF0F5]'
                  : 'text-[#6F1F3B] hover:bg-[#E2A6BA]/30'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Nhân vật ({characters.length})</span>
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
                Thông báo ({unreadCount > 0 ? `${unreadCount} mới` : notifications.length})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: CHARACTERS */}
      {tab === 'chars' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <form
            onSubmit={handleCharSubmit}
            className="space-y-4 rounded-3xl border border-[#B65A7C]/25 bg-[#FFF0F5]/90 p-6 shadow-sm lg:col-span-5"
          >
            <h2 className="font-cute text-lg font-bold text-[#3A071F]">
              {editingCharId ? 'Chỉnh sửa nhân vật' : 'Thêm nhân vật mới'}
            </h2>

            <div className="flex items-center gap-4">
              <AvatarFrame src={charAvatar} alt={charName || 'Avatar'} size="sm" />
              <div className="min-w-0 flex-1 space-y-2">
                <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-[#B65A7C]/35 bg-white px-4 py-1.5 text-xs font-semibold text-[#6F1F3B] hover:bg-[#E2A6BA]/25">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Tải ảnh lên</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_AVATARS.map((p) => (
                    <button
                      key={p.url}
                      type="button"
                      onClick={() => setCharAvatar(p.url)}
                      className="cursor-pointer rounded-lg border border-[#E2A6BA] bg-white px-2 py-0.5 text-[11px] font-medium text-[#6F1F3B] hover:bg-[#E2A6BA]/30"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">
                URL ảnh đại diện
              </label>
              <input
                type="text"
                value={charAvatar}
                onChange={(e) => setCharAvatar(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
              />
            </div>

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
                rows={4}
                maxLength={5000}
                value={charStory}
                onChange={(e) => setCharStory(e.target.value)}
                className="w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">
                Link mua kẹo (gắn vào nút Mua Kẹo Ở Đây)
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

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#6F1F3B] px-5 py-2 text-sm font-bold text-[#FFF0F5] hover:bg-[#3A071F] disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                <span>{editingCharId ? 'Lưu cập nhật' : 'Thêm nhân vật'}</span>
              </button>
              {editingCharId && (
                <button
                  type="button"
                  onClick={resetCharForm}
                  className="min-h-[44px] cursor-pointer rounded-full border border-[#B65A7C]/35 px-4 py-2 text-xs font-semibold text-[#6F1F3B] hover:bg-white"
                >
                  Hủy
                </button>
              )}
            </div>
          </form>

          <div className="space-y-3 lg:col-span-7">
            {characters.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-[#B65A7C]/20 bg-[#FFF0F5]/85 p-4 shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <AvatarFrame src={c.avatar} alt={c.name} size="sm" />
                  <div className="min-w-0">
                    <h3 className="font-cute truncate text-base font-bold text-[#3A071F]">
                      {c.name}
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
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#E2A6BA] bg-white text-[#6F1F3B] hover:bg-[#E2A6BA]/30"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingDelete({ kind: 'character', id: c.id, label: c.name })
                    }
                    aria-label={`Xóa ${c.name}`}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#E2A6BA] bg-white text-[#6F1F3B] hover:bg-[#3A071F] hover:text-[#FFF0F5]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: MUSIC */}
      {tab === 'music' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <form
            onSubmit={handleTrackSubmit}
            className="space-y-4 rounded-3xl border border-[#B65A7C]/25 bg-[#FFF0F5]/90 p-6 shadow-sm lg:col-span-5"
          >
            <h2 className="font-cute text-lg font-bold text-[#3A071F]">
              {editingTrackId ? 'Chỉnh sửa bài nhạc' : 'Thêm nhạc mới'}
            </h2>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">
                Tên bài hát *
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={trackTitle}
                onChange={(e) => setTrackTitle(e.target.value)}
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

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">
                Cảm xúc / Thể loại
              </label>
              <input
                type="text"
                maxLength={100}
                value={trackMood}
                onChange={(e) => setTrackMood(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">
                Link MP3 / Audio
              </label>
              <input
                type="url"
                maxLength={500}
                value={trackUrl}
                onChange={(e) => setTrackUrl(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6F1F3B]">
                Giai điệu hộp nhạc dự phòng
              </label>
              <select
                value={trackPreset}
                onChange={(e) =>
                  setTrackPreset(e.target.value as MusicTrack['synthPreset'])
                }
                className="min-h-[42px] w-full rounded-xl border border-[#B65A7C]/30 bg-white px-3 py-2 text-sm text-[#3A071F] focus:border-[#6F1F3B] focus:outline-none"
              >
                <option value="rose_waltz">Valse Hoa Hồng</option>
                <option value="cotton_lullaby">Khúc Ru Kẹo Bông</option>
                <option value="velvet_nocturne">Dạ Khúc Nhung</option>
                <option value="petal_breeze">Gió Cánh Hoa</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#6F1F3B] px-5 py-2 text-sm font-bold text-[#FFF0F5] hover:bg-[#3A071F] disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                <span>{editingTrackId ? 'Lưu bài hát' : 'Thêm bài hát'}</span>
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
                    <p className="truncate text-xs text-[#6F1F3B]/80">
                      {t.artist} · {t.mood}
                    </p>
                    {t.audioUrl && (
                      <p className="mt-0.5 truncate text-[11px] text-[#B65A7C]">{t.audioUrl}</p>
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

      {/* TAB 3: NOTIFICATIONS */}
      {tab === 'notifications' && (
        <div className="space-y-3 rounded-3xl border border-[#B65A7C]/25 bg-[#FFF0F5]/90 p-6 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-cute text-lg font-bold text-[#3A071F]">
              Thông báo tim &amp; bình luận gửi về hminhthom203@gmail.com
            </h2>
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
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => onMarkNotificationRead(n.id)}
                        aria-label="Đánh dấu đã đọc"
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#6F1F3B] hover:bg-[#E2A6BA]/30"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
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
