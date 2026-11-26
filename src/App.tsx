import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { Heart, Eye, Search, LogOut, ShieldCheck, User } from 'lucide-react';
import {
  AdminNotification,
  AppView,
  Character,
  CharacterComment,
  MusicTrack,
  UserProfile,
} from './types';
import { ADMIN_EMAIL, SEED_CHARACTERS } from './data/initialData';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { soundEngine } from './utils/soundEngine';
import { PetalCanvas } from './components/PetalCanvas';
import { IntroPage } from './components/IntroPage';
import { AvatarFrame } from './components/AvatarFrame';
import { Tilt3DCard } from './components/Tilt3DCard';
import { CharacterDetailPage } from './components/CharacterDetailPage';
import { MusicPage } from './components/MusicPage';
import { MusicDock } from './components/MusicDock';
import { AdminPage } from './components/AdminPage';
import { AuthModal } from './components/AuthModal';

function tsToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function slugId(raw: string): string {
  const base = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'item'}-${Date.now().toString(36)}`;
}

export default function App() {
  const [view, setView] = useState<AppView>('intro');
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [comments, setComments] = useState<CharacterComment[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeHashtag, setActiveHashtag] = useState<string>('all');

  const [currentTrackId, setCurrentTrackId] = useState<string>('');
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.45);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  const cleanedSampleTracksRef = useRef(false);

  // 1. Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setCurrentUser(null);
        setLikedIds(new Set());
        setNotifications([]);
        setAuthReady(true);
        return;
      }
      const email = (fbUser.email || '').toLowerCase();
      const isAdmin = email === ADMIN_EMAIL && fbUser.emailVerified;
      const profile: UserProfile = {
        uid: fbUser.uid,
        name: fbUser.displayName || email.split('@')[0] || 'Thành viên',
        email,
        emailVerified: fbUser.emailVerified,
        role: isAdmin ? 'admin' : 'viewer',
      };
      setCurrentUser(profile);
      setAuthReady(true);

      if (fbUser.emailVerified && !isAdmin) {
        const userRef = doc(db, 'users', fbUser.uid);
        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              uid: fbUser.uid,
              name: profile.name.slice(0, 80),
              email: profile.email.slice(0, 160),
              role: 'viewer',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(userRef, {
              name: profile.name.slice(0, 80),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${fbUser.uid}`);
        }
      }
    });
    return () => unsub();
  }, []);

  // 2. Listen to Characters collection
  useEffect(() => {
    const q = query(collection(db, 'characters'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: Character[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || ''),
            avatar: String(data.avatar || ''),
            hashtags: Array.isArray(data.hashtags) ? data.hashtags.map(String) : [],
            slogan: String(data.slogan || ''),
            story: String(data.story || ''),
            link: String(data.link || ''),
            linkLabel: String(data.linkLabel || 'Mua Kẹo Ở Đây'),
            likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
            viewsCount: typeof data.viewsCount === 'number' ? data.viewsCount : 0,
            createdAt: tsToIso(data.createdAt),
            updatedAt: tsToIso(data.updatedAt),
          };
        });
        setCharacters(items);
        setLoadingChars(false);
      },
      (err) => {
        setLoadingChars(false);
        handleFirestoreError(err, OperationType.LIST, 'characters');
      }
    );
    return () => unsub();
  }, []);

  // 3. Listen to Tracks collection
  useEffect(() => {
    const q = query(collection(db, 'tracks'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setTracks([]);
          soundEngine.pauseMusic();
          setIsPlayingMusic(false);
          return;
        }
        const items: MusicTrack[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title || ''),
            artist: String(data.artist || ''),
            mood: String(data.mood || ''),
            durationLabel: String(data.durationLabel || 'Vòng lặp êm ái'),
            audioUrl: String(data.audioUrl || ''),
            synthPreset: (data.synthPreset as MusicTrack['synthPreset']) || 'rose_waltz',
            createdAt: tsToIso(data.createdAt),
            updatedAt: tsToIso(data.updatedAt),
          };
        });
        setTracks(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'tracks');
      }
    );
    return () => unsub();
  }, []);

  // 4. Listen to Admin Notifications when signed in as Admin
  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      setNotifications([]);
      return;
    }
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AdminNotification[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type === 'comment' ? 'comment' : 'like',
            characterId: String(data.characterId || ''),
            characterName: String(data.characterName || ''),
            actorUid: String(data.actorUid || ''),
            actorName: String(data.actorName || ''),
            message: String(data.message || ''),
            recipientEmail: String(data.recipientEmail || ADMIN_EMAIL),
            emailStatus:
              (data.emailStatus as AdminNotification['emailStatus']) || 'not_configured',
            read: Boolean(data.read),
            createdAt: tsToIso(data.createdAt),
          };
        });
        setNotifications(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'notifications');
      }
    );
    return () => unsub();
  }, [currentUser]);

  // 5. Manual sample character seeding (never auto-reseed after deletions)
  const handleSeedDefaults = async () => {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      const batch = writeBatch(db);
      SEED_CHARACTERS.forEach((c) => {
        const ref = doc(db, 'characters', c.id);
        batch.set(ref, {
          name: c.name,
          avatar: c.avatar,
          hashtags: c.hashtags,
          slogan: c.slogan,
          story: c.story,
          link: c.link,
          linkLabel: 'Mua Kẹo Ở Đây',
          likesCount: 0,
          viewsCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      soundEngine.playSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'characters');
    }
  };

  // Remove previously seeded sample tracks from Firestore once so admin can add their own
  useEffect(() => {
    if (currentUser?.role !== 'admin' || tracks.length === 0 || cleanedSampleTracksRef.current) {
      return;
    }
    const sampleTrackIds = new Set([
      'track-rose-waltz',
      'track-cotton-lullaby',
      'track-velvet-nocturne',
      'track-petal-breeze',
    ]);
    const toRemove = tracks.filter((t) => sampleTrackIds.has(t.id));
    if (toRemove.length === 0) {
      cleanedSampleTracksRef.current = true;
      return;
    }
    cleanedSampleTracksRef.current = true;
    const batch = writeBatch(db);
    toRemove.forEach((t) => batch.delete(doc(db, 'tracks', t.id)));
    void batch.commit().catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, 'tracks');
    });
  }, [currentUser, tracks]);

  // 6. Check liked characters for current user
  useEffect(() => {
    if (!currentUser || characters.length === 0) {
      if (!currentUser) setLikedIds(new Set());
      return;
    }
    let cancelled = false;
    const loadLikes = async () => {
      const liked = new Set<string>();
      await Promise.all(
        characters.map(async (c) => {
          try {
            const snap = await getDoc(
              doc(db, 'characters', c.id, 'likes', currentUser.uid)
            );
            if (snap.exists()) liked.add(c.id);
          } catch {
            // ignore
          }
        })
      );
      if (!cancelled) setLikedIds(liked);
    };
    void loadLikes();
    return () => {
      cancelled = true;
    };
  }, [currentUser, characters]);

  // 7. Listen to comments on Detail view
  useEffect(() => {
    if (view !== 'detail' || !selectedCharId) {
      setComments([]);
      return;
    }
    const path = `characters/${selectedCharId}/comments`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: CharacterComment[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            characterId: String(data.characterId || selectedCharId),
            authorUid: String(data.authorUid || ''),
            authorName: String(data.authorName || ''),
            content: String(data.content || ''),
            createdAt: tsToIso(data.createdAt),
            updatedAt: tsToIso(data.updatedAt),
          };
        });
        setComments(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    return () => unsub();
  }, [view, selectedCharId]);

  // First-click autoplay
  useEffect(() => {
    if (hasAutoStarted) return;
    const handleFirstPointer = () => {
      if (hasAutoStarted) return;
      const firstTrack = tracks.find((t) => t.id === currentTrackId) || tracks[0];
      if (firstTrack) {
        soundEngine.unlock();
        soundEngine.playTrack(firstTrack);
        setCurrentTrackId(firstTrack.id);
        setIsPlayingMusic(true);
        setHasAutoStarted(true);
      }
    };
    window.addEventListener('pointerdown', handleFirstPointer, { once: true });
    return () => window.removeEventListener('pointerdown', handleFirstPointer);
  }, [hasAutoStarted, tracks, currentTrackId]);

  const currentTrack = useMemo(
    () => tracks.find((t) => t.id === currentTrackId) || tracks[0],
    [tracks, currentTrackId]
  );

  const allHashtags = useMemo(() => {
    const set = new Set<string>();
    characters.forEach((c) => c.hashtags.forEach((h) => set.add(h.replace(/^#/, ''))));
    return Array.from(set);
  }, [characters]);

  const filteredCharacters = useMemo(() => {
    return characters.filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.slogan.toLowerCase().includes(q) ||
        c.hashtags.some((h) => h.toLowerCase().includes(q));
      const matchesTag =
        activeHashtag === 'all' ||
        c.hashtags.some((h) => h.replace(/^#/, '') === activeHashtag);
      return matchesQuery && matchesTag;
    });
  }, [characters, searchQuery, activeHashtag]);

  const selectedCharacter = useMemo(
    () => characters.find((c) => c.id === selectedCharId) || null,
    [characters, selectedCharId]
  );

  const notifyAdmin = async (
    type: 'like' | 'comment',
    character: Character,
    message: string
  ) => {
    if (!currentUser) return;
    let emailStatus: AdminNotification['emailStatus'] = 'not_configured';
    try {
      const resp = await fetch('/api/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          characterName: character.name,
          actorName: currentUser.name,
          message,
        }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { status?: AdminNotification['emailStatus'] };
        if (data.status === 'sent' || data.status === 'queued') {
          emailStatus = data.status;
        }
      }
    } catch {
      // keep fallback status
    }

    const notifId = `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const path = `notifications/${notifId}`;
    try {
      await setDoc(doc(db, path), {
        type,
        characterId: character.id,
        characterName: character.name.slice(0, 80),
        actorUid: currentUser.uid,
        actorName: currentUser.name.slice(0, 80),
        message: message.slice(0, 600),
        recipientEmail: ADMIN_EMAIL,
        emailStatus,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleEnterFromIntro = () => {
    soundEngine.unlock();
    soundEngine.playSparkle();
    const first = tracks.find((t) => t.id === currentTrackId) || tracks[0];
    if (first && !isPlayingMusic) {
      soundEngine.playTrack(first);
      setCurrentTrackId(first.id);
      setIsPlayingMusic(true);
      setHasAutoStarted(true);
    }
    setView('gallery');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (nextView: AppView) => {
    soundEngine.playPageTurn();
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDetail = async (charId: string) => {
    soundEngine.playPageTurn();
    setSelectedCharId(charId);
    setView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const charRef = doc(db, 'characters', charId);
    try {
      await updateDoc(charRef, { viewsCount: increment(1) });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `characters/${charId}`);
    }
  };

  const handleTogglePlay = () => {
    soundEngine.playChime();
    if (isPlayingMusic) {
      soundEngine.pauseMusic();
      setIsPlayingMusic(false);
    } else if (currentTrack) {
      soundEngine.playTrack(currentTrack);
      setIsPlayingMusic(true);
      setHasAutoStarted(true);
    }
  };

  const handleSelectTrack = (track: MusicTrack) => {
    soundEngine.playChime();
    setCurrentTrackId(track.id);
    soundEngine.playTrack(track);
    setIsPlayingMusic(true);
    setHasAutoStarted(true);
  };

  const handleNextTrack = () => {
    if (tracks.length === 0) return;
    soundEngine.playChime();
    const idx = tracks.findIndex((t) => t.id === currentTrackId);
    const next = tracks[(idx + 1) % tracks.length];
    setCurrentTrackId(next.id);
    soundEngine.playTrack(next);
    setIsPlayingMusic(true);
    setHasAutoStarted(true);
  };

  const handleChangeVolume = (val: number) => {
    setMusicVolume(val);
    soundEngine.setVolume(val);
  };

  const handleToggleSfx = () => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    soundEngine.setSfxEnabled(next);
    if (next) soundEngine.playChime();
  };

  const handleToggleLike = async (charId: string) => {
    if (!currentUser || !currentUser.emailVerified) {
      setAuthModalOpen(true);
      return;
    }
    const targetChar = characters.find((c) => c.id === charId);
    const alreadyLiked = likedIds.has(charId);
    const charRef = doc(db, 'characters', charId);
    const likeRef = doc(db, 'characters', charId, 'likes', currentUser.uid);

    soundEngine.playHeartPop();
    const batch = writeBatch(db);
    if (alreadyLiked) {
      batch.delete(likeRef);
      batch.update(charRef, {
        likesCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(likeRef, {
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      batch.update(charRef, {
        likesCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (alreadyLiked) next.delete(charId);
        else next.add(charId);
        return next;
      });

      if (!alreadyLiked && targetChar) {
        void notifyAdmin(
          'like',
          targetChar,
          `${currentUser.name} đã thả tim cho nhân vật ${targetChar.name}.`
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `characters/${charId}/likes/${currentUser.uid}`);
    }
  };

  const handleAddComment = async (charId: string, content: string) => {
    if (!currentUser || !currentUser.emailVerified) {
      setAuthModalOpen(true);
      return;
    }
    const targetChar = characters.find((c) => c.id === charId);
    const commentId = `cmt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const path = `characters/${charId}/comments/${commentId}`;
    try {
      await setDoc(doc(db, path), {
        characterId: charId,
        authorUid: currentUser.uid,
        authorName: currentUser.name.slice(0, 80),
        content: content.slice(0, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      soundEngine.playSuccess();
      if (targetChar) {
        void notifyAdmin('comment', targetChar, content);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleUpdateComment = async (
    charId: string,
    commentId: string,
    content: string
  ) => {
    const path = `characters/${charId}/comments/${commentId}`;
    try {
      await updateDoc(doc(db, path), {
        content: content.slice(0, 500),
        updatedAt: serverTimestamp(),
      });
      soundEngine.playSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteComment = async (charId: string, commentId: string) => {
    const path = `characters/${charId}/comments/${commentId}`;
    try {
      await deleteDoc(doc(db, path));
      soundEngine.playChime();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Admin CRUD
  const handleSaveCharacter = async (input: {
    id?: string;
    name: string;
    avatar: string;
    hashtags: string[];
    slogan: string;
    story: string;
    link: string;
    linkLabel: string;
  }) => {
    if (input.id) {
      const path = `characters/${input.id}`;
      try {
        await updateDoc(doc(db, path), {
          name: input.name,
          avatar: input.avatar,
          hashtags: input.hashtags,
          slogan: input.slogan,
          story: input.story,
          link: input.link,
          linkLabel: input.linkLabel,
          updatedAt: serverTimestamp(),
        });
        soundEngine.playSuccess();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    } else {
      const newId = slugId(input.name);
      const path = `characters/${newId}`;
      try {
        await setDoc(doc(db, path), {
          name: input.name,
          avatar: input.avatar,
          hashtags: input.hashtags,
          slogan: input.slogan,
          story: input.story,
          link: input.link,
          linkLabel: input.linkLabel,
          likesCount: 0,
          viewsCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        soundEngine.playSuccess();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    const path = `characters/${id}`;
    try {
      await deleteDoc(doc(db, path));
      soundEngine.playChime();
      if (selectedCharId === id) {
        setSelectedCharId(null);
        if (view === 'detail') setView('gallery');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleSaveTrack = async (input: {
    id?: string;
    title: string;
    artist: string;
    mood: string;
    durationLabel: string;
    audioUrl: string;
    synthPreset: MusicTrack['synthPreset'];
  }) => {
    if (input.id) {
      const path = `tracks/${input.id}`;
      try {
        await updateDoc(doc(db, path), {
          title: input.title,
          artist: input.artist,
          mood: input.mood,
          durationLabel: input.durationLabel,
          audioUrl: input.audioUrl,
          synthPreset: input.synthPreset,
          updatedAt: serverTimestamp(),
        });
        soundEngine.playSuccess();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    } else {
      const newId = slugId(input.title);
      const path = `tracks/${newId}`;
      try {
        await setDoc(doc(db, path), {
          title: input.title,
          artist: input.artist,
          mood: input.mood,
          durationLabel: input.durationLabel,
          audioUrl: input.audioUrl,
          synthPreset: input.synthPreset,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        soundEngine.playSuccess();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
  };

  const handleDeleteTrack = async (id: string) => {
    const path = `tracks/${id}`;
    try {
      await deleteDoc(doc(db, path));
      if (currentTrackId === id) {
        soundEngine.pauseMusic();
        setIsPlayingMusic(false);
        setCurrentTrackId('');
      }
      soundEngine.playChime();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleDeleteAllTracks = async () => {
    if (tracks.length === 0) return;
    try {
      const batch = writeBatch(db);
      tracks.forEach((t) => batch.delete(doc(db, 'tracks', t.id)));
      await batch.commit();
      soundEngine.pauseMusic();
      setIsPlayingMusic(false);
      setCurrentTrackId('');
      soundEngine.playChime();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'tracks');
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    const path = `notifications/${id}`;
    try {
      await updateDoc(doc(db, path), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    const path = `notifications/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  if (view === 'intro') {
    return (
      <div className="relative min-h-screen w-full max-w-full overflow-x-hidden">
        <PetalCanvas variant="intro" />
        <IntroPage onEnter={handleEnterFromIntro} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-br from-[#FFF0F5] via-[#F7DBE6] to-[#E2A6BA] text-[#3A071F]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(255,240,245,0.9),transparent_48%),radial-gradient(circle_at_85%_80%,rgba(182,90,124,0.22),transparent_52%)]"
      />
      <PetalCanvas variant="main" />

      <header className="sticky top-0 z-30 border-b border-[#B65A7C]/20 bg-[#FFF0F5]/82 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:gap-8 sm:px-6">
          <button
            type="button"
            onClick={() => handleNavigate('intro')}
            className="font-cute cursor-pointer bg-gradient-to-r from-[#C23B72] via-[#E06D9A] to-[#B64874] bg-clip-text text-lg font-bold tracking-tight text-transparent drop-shadow-[0_1px_6px_rgba(224,109,154,0.3)] whitespace-nowrap shrink-0 sm:text-xl"
          >
            Ăn Kẹo Hong
          </button>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-[#6F1F3B] md:flex">
            <button
              type="button"
              onClick={() => handleNavigate('gallery')}
              className={`cursor-pointer transition-colors whitespace-nowrap shrink-0 hover:text-[#3A071F] ${
                view === 'gallery' || view === 'detail'
                  ? 'text-[#3A071F] underline decoration-[#B65A7C] decoration-2 underline-offset-4'
                  : ''
              }`}
            >
              Nhân Vật
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('music')}
              className={`cursor-pointer transition-colors whitespace-nowrap shrink-0 hover:text-[#3A071F] ${
                view === 'music'
                  ? 'text-[#3A071F] underline decoration-[#B65A7C] decoration-2 underline-offset-4'
                  : ''
              }`}
            >
              Âm Nhạc
            </button>
            {currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={() => handleNavigate('admin')}
                className={`cursor-pointer transition-colors whitespace-nowrap shrink-0 hover:text-[#3A071F] ${
                  view === 'admin'
                    ? 'text-[#3A071F] underline decoration-[#B65A7C] decoration-2 underline-offset-4'
                    : ''
                }`}
              >
                Quản Trị
              </button>
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="hidden max-w-[140px] truncate text-xs font-semibold text-[#6F1F3B] sm:inline-flex sm:items-center sm:gap-1">
                  {currentUser.role === 'admin' ? (
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#6F1F3B]" />
                  ) : (
                    <User className="h-3.5 w-3.5 shrink-0 text-[#B65A7C]" />
                  )}
                  <span className="truncate">{currentUser.name}</span>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    soundEngine.playChime();
                    await signOut(auth);
                    if (view === 'admin') setView('gallery');
                  }}
                  aria-label="Đăng xuất"
                  className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-[#B65A7C]/35 bg-white/85 px-3.5 py-1.5 text-xs font-semibold text-[#6F1F3B] transition-colors whitespace-nowrap shrink-0 hover:bg-[#3A071F] hover:text-[#FFF0F5]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playChime();
                  setAuthModalOpen(true);
                }}
                className="inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-full bg-[#6F1F3B] px-4 py-2 text-xs font-bold text-[#FFF0F5] shadow-sm transition-colors whitespace-nowrap shrink-0 hover:bg-[#3A071F]"
              >
                Đăng nhập
              </button>
            )}
          </div>
        </div>

        <nav className="flex items-center justify-center gap-5 border-t border-[#B65A7C]/15 px-4 py-2 text-xs font-semibold text-[#6F1F3B] md:hidden">
          <button
            type="button"
            onClick={() => handleNavigate('gallery')}
            className={`cursor-pointer whitespace-nowrap ${
              view === 'gallery' || view === 'detail'
                ? 'text-[#3A071F] underline decoration-[#B65A7C] decoration-2 underline-offset-4'
                : ''
            }`}
          >
            Nhân Vật
          </button>
          <button
            type="button"
            onClick={() => handleNavigate('music')}
            className={`cursor-pointer whitespace-nowrap ${
              view === 'music'
                ? 'text-[#3A071F] underline decoration-[#B65A7C] decoration-2 underline-offset-4'
                : ''
            }`}
          >
            Âm Nhạc
          </button>
          {currentUser?.role === 'admin' && (
            <button
              type="button"
              onClick={() => handleNavigate('admin')}
              className={`cursor-pointer whitespace-nowrap ${
                view === 'admin'
                  ? 'text-[#3A071F] underline decoration-[#B65A7C] decoration-2 underline-offset-4'
                  : ''
              }`}
            >
              Quản Trị
            </button>
          )}
        </nav>
      </header>

      <main className="relative z-20 pt-6">
        {view === 'gallery' && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto w-full max-w-6xl px-4 pb-28 sm:px-6"
          >
            <div className="mb-8 text-center">
              <h1
                className="font-cute mb-3 bg-gradient-to-r from-[#6F1F3B] via-[#B65A7C] to-[#8E2B4E] bg-clip-text text-3xl font-bold tracking-tight text-transparent drop-shadow-[0_2px_10px_rgba(182,90,124,0.22)] sm:text-5xl"
                style={{ textWrap: 'balance' }}
              >
                Xem Và Mua Kẹo Nha
              </h1>
              <p className="mx-auto max-w-2xl text-sm font-medium text-[#6F1F3B] sm:text-base">
                Giữa muôn vàn cuộc gặp gỡ ngoài kia, cảm ơn bạn vì đã ghé qua nơi này
              </p>
            </div>

            <div className="mb-8 flex flex-col items-stretch justify-between gap-4 rounded-3xl border border-[#B65A7C]/20 bg-[#FFF0F5]/80 p-4 backdrop-blur-sm md:flex-row md:items-center">
              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#B65A7C]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên, slogan hoặc hashtag..."
                  className="min-h-[42px] w-full rounded-full border border-[#B65A7C]/25 bg-white/90 py-2 pr-4 pl-10 text-sm text-[#3A071F] placeholder-[#B65A7C]/70 focus:border-[#6F1F3B] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playChime();
                    setActiveHashtag('all');
                  }}
                  className={`min-h-[38px] cursor-pointer rounded-full px-3.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                    activeHashtag === 'all'
                      ? 'bg-[#6F1F3B] text-[#FFF0F5]'
                      : 'bg-white/75 text-[#6F1F3B] hover:bg-white'
                  }`}
                >
                  Tất cả
                </button>
                {allHashtags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      soundEngine.playChime();
                      setActiveHashtag(tag);
                    }}
                    className={`min-h-[38px] cursor-pointer rounded-full px-3.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                      activeHashtag === tag
                        ? 'bg-[#6F1F3B] text-[#FFF0F5]'
                        : 'bg-white/75 text-[#6F1F3B] hover:bg-white'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {loadingChars ? (
              <div className="rounded-3xl border border-[#B65A7C]/20 bg-[#FFF0F5]/80 p-12 text-center text-sm font-semibold text-[#6F1F3B]">
                Đang tải danh sách nhân vật từ Firebase...
              </div>
            ) : filteredCharacters.length === 0 ? (
              <div className="rounded-3xl border border-[#B65A7C]/20 bg-[#FFF0F5]/80 p-12 text-center">
                <p className="font-cute text-lg font-bold text-[#3A071F]">
                  {characters.length === 0
                    ? 'Chưa có nhân vật nào'
                    : 'Không tìm thấy nhân vật phù hợp'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCharacters.map((char) => {
                  const isLiked = likedIds.has(char.id);

                  return (
                    <Tilt3DCard
                      key={char.id}
                      onHoverSound={() => soundEngine.playHoverTick()}
                      className="group"
                    >
                      <article className="flex h-full flex-col items-center rounded-3xl border border-[#B65A7C]/25 bg-[#FFF0F5]/88 p-6 text-center shadow-[0_14px_38px_-14px_rgba(111,31,59,0.2)] backdrop-blur-md transition-shadow duration-200 hover:shadow-[0_22px_48px_-12px_rgba(111,31,59,0.32)]">
                        <div className="mb-5 transition-transform duration-300 group-hover:-translate-y-1">
                          <AvatarFrame src={char.avatar} alt={char.name} size="md" />
                        </div>

                        <div className="mb-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs font-semibold text-[#B65A7C]">
                          {char.hashtags.slice(0, 3).map((tag, idx) => (
                            <React.Fragment key={tag}>
                              <span>#{tag.replace(/^#/, '')}</span>
                              {idx < Math.min(char.hashtags.length, 3) - 1 && (
                                <span aria-hidden="true" className="opacity-50">
                                  ·
                                </span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>

                        <h2 className="font-cute mb-2 text-xl font-bold text-[#3A071F]">
                          {char.name}
                        </h2>

                        <p className="mb-5 line-clamp-2 text-sm leading-relaxed text-[#6F1F3B]/90">
                          “{char.slogan}”
                        </p>

                        <div className="mt-auto flex w-full items-center justify-between border-t border-[#E2A6BA]/45 pt-4 text-xs font-semibold text-[#6F1F3B]">
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => void handleToggleLike(char.id)}
                              aria-label={`Thả tim cho ${char.name}`}
                              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 transition-transform hover:scale-105"
                            >
                              <Heart
                                className={`h-4 w-4 ${
                                  isLiked
                                    ? 'fill-[#6F1F3B] text-[#6F1F3B]'
                                    : 'text-[#B65A7C]'
                                }`}
                              />
                              <span className="tabular-nums">{char.likesCount}</span>
                            </button>

                            <span className="inline-flex items-center gap-1.5 text-[#6F1F3B]/80">
                              <Eye className="h-4 w-4 text-[#B65A7C]" />
                              <span className="tabular-nums">{char.viewsCount}</span>
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => void handleOpenDetail(char.id)}
                            className="min-h-[36px] cursor-pointer rounded-full bg-[#6F1F3B] px-4 py-1.5 text-xs font-bold text-[#FFF0F5] transition-colors hover:bg-[#3A071F]"
                          >
                            Chi tiết
                          </button>
                        </div>
                      </article>
                    </Tilt3DCard>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {view === 'detail' && selectedCharacter && (
          <CharacterDetailPage
            character={selectedCharacter}
            comments={comments}
            isLiked={likedIds.has(selectedCharacter.id)}
            currentUser={currentUser}
            onBack={() => handleNavigate('gallery')}
            onToggleLike={handleToggleLike}
            onAddComment={handleAddComment}
            onUpdateComment={handleUpdateComment}
            onDeleteComment={handleDeleteComment}
            onRequestAuth={() => setAuthModalOpen(true)}
            onPlayHoverSound={() => soundEngine.playHoverTick()}
          />
        )}

        {view === 'music' && (
          <MusicPage
            tracks={tracks}
            currentTrackId={currentTrackId}
            isPlaying={isPlayingMusic}
            volume={musicVolume}
            sfxEnabled={sfxEnabled}
            onSelectTrack={handleSelectTrack}
            onTogglePlay={handleTogglePlay}
            onChangeVolume={handleChangeVolume}
            onToggleSfx={handleToggleSfx}
            onPlayHoverSound={() => soundEngine.playHoverTick()}
          />
        )}

        {view === 'admin' && currentUser?.role === 'admin' && (
          <AdminPage
            characters={characters}
            tracks={tracks}
            notifications={notifications}
            onSaveCharacter={handleSaveCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            onSaveTrack={handleSaveTrack}
            onDeleteTrack={handleDeleteTrack}
            onDeleteAllTracks={handleDeleteAllTracks}
            onMarkNotificationRead={handleMarkNotificationRead}
            onDeleteNotification={handleDeleteNotification}
            onSeedDefaults={handleSeedDefaults}
          />
        )}
      </main>

      <MusicDock
        currentTrack={currentTrack}
        isPlaying={isPlayingMusic}
        sfxEnabled={sfxEnabled}
        onTogglePlay={handleTogglePlay}
        onNextTrack={handleNextTrack}
        onToggleSfx={handleToggleSfx}
        onOpenMusicPage={() => handleNavigate('music')}
      />

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
