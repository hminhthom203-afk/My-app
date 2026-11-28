import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
import {
  Heart,
  Eye,
  Search,
  LogOut,
  ShieldCheck,
  User,
  AlertCircle,
  X,
  MailWarning,
  MessageCircle,
  Crown,
  Bell,
} from 'lucide-react';
import {
  AdminNotification,
  AppView,
  Character,
  CharacterComment,
  CommunityChatMessage,
  MusicTrack,
  UserProfile,
} from './types';
import { ADMIN_EMAIL, SEED_CHARACTERS } from './data/initialData';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { soundEngine } from './utils/soundEngine';
import { normalizeMediaUrl } from './utils/mediaHelpers';
import { getPastelTagClass, SLOGAN_BOX_CLASS } from './utils/pastelTags';
import { IntroPage } from './components/IntroPage';
import { AvatarFrame } from './components/AvatarFrame';
import { Tilt3DCard } from './components/Tilt3DCard';
import { CharacterDetailPage } from './components/CharacterDetailPage';
import { ChatPage } from './components/ChatPage';
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
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'item'}-${Date.now().toString(36)}`;
}

function buildLikeNotifId(uid: string, charId: string): string {
  return `like_${uid}_${charId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export default function App() {
  const [view, setView] = useState<AppView>('intro');
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingChars, setLoadingChars] = useState(true);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [comments, setComments] = useState<CharacterComment[]>([]);
  const [chatMessages, setChatMessages] = useState<CommunityChatMessage[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [previousListView, setPreviousListView] = useState<'gallery' | 'top' | 'chat' | 'liked'>('gallery');

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeHashtag, setActiveHashtag] = useState<string>('all');

  const [currentTrackId, setCurrentTrackId] = useState<string>('');
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [isShuffle, setIsShuffle] = useState(true);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  const cleanedSampleTracksRef = useRef(false);
  const tracksRef = useRef<MusicTrack[]>([]);
  const currentTrackIdRef = useRef<string>('');
  const isShuffleRef = useRef<boolean>(true);
  const navScrollRef = useRef<HTMLElement | null>(null);
  const navDragRef = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    currentTrackIdRef.current = currentTrackId;
  }, [currentTrackId]);

  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);

  const reportActionFailure = (
    err: unknown,
    operationType: OperationType,
    path: string,
    friendlyMessage: string
  ) => {
    setActionError(friendlyMessage);
    try {
      handleFirestoreError(err, operationType, path);
    } catch {
      // Structured FirestoreErrorInfo already logged to console by handleFirestoreError
    }
  };

  const syncFirebaseUser = async (
    fbUser: typeof auth.currentUser,
    explicitNickname?: string
  ) => {
    if (!fbUser) {
      setCurrentUser(null);
      setLikedIds(new Set());
      setNotifications([]);
      setAuthReady(true);
      return;
    }
    const email = (fbUser.email || '').toLowerCase();
    const isAdmin = email === ADMIN_EMAIL && fbUser.emailVerified;

    let pendingNick = '';
    try {
      pendingNick = (
        explicitNickname ||
        localStorage.getItem('candy_pending_nickname') ||
        ''
      ).trim();
    } catch {
      pendingNick = (explicitNickname || '').trim();
    }

    let cachedUidNick = '';
    try {
      cachedUidNick = (localStorage.getItem(`candy_nickname_${fbUser.uid}`) || '').trim();
    } catch {
      cachedUidNick = '';
    }

    const fbDisplay = (fbUser.displayName || '').trim();
    const isGoogleProvider = fbUser.providerData.some((p) => p?.providerId === 'google.com');

    let resolvedName =
      pendingNick ||
      cachedUidNick ||
      (!isGoogleProvider ? fbDisplay : '') ||
      (isAdmin ? fbDisplay || 'Chủ Tiệm Kẹo' : '');

    if (fbUser.emailVerified && !isAdmin) {
      const userRef = doc(db, 'users', fbUser.uid);
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          if (resolvedName) {
            await setDoc(userRef, {
              uid: fbUser.uid,
              name: resolvedName.slice(0, 80),
              email: email.slice(0, 160),
              role: 'viewer',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          const existingName = String(snap.data()?.name || '').trim();
          if (pendingNick) {
            resolvedName = pendingNick;
            if (existingName !== resolvedName.slice(0, 80)) {
              await updateDoc(userRef, {
                name: resolvedName.slice(0, 80),
                updatedAt: serverTimestamp(),
              });
            }
          } else if (existingName) {
            resolvedName = existingName;
          } else if (resolvedName) {
            await updateDoc(userRef, {
              name: resolvedName.slice(0, 80),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        reportActionFailure(
          err,
          OperationType.WRITE,
          `users/${fbUser.uid}`,
          'Không thể đồng bộ hồ sơ tài khoản lên Firebase.'
        );
      }
    }

    try {
      if (resolvedName && resolvedName !== 'Thành viên') {
        localStorage.setItem(`candy_nickname_${fbUser.uid}`, resolvedName.slice(0, 80));
      }
      if (pendingNick && fbUser.emailVerified) {
        localStorage.removeItem('candy_pending_nickname');
      }
    } catch {
      // ignore storage failure
    }

    const finalName = (resolvedName || (isAdmin ? 'Chủ Tiệm Kẹo' : 'Thành viên')).slice(0, 80);

    const profile: UserProfile = {
      uid: fbUser.uid,
      name: finalName,
      email,
      emailVerified: fbUser.emailVerified,
      role: isAdmin ? 'admin' : 'viewer',
    };
    setCurrentUser(profile);
    setAuthReady(true);

    if (fbUser.emailVerified && !isAdmin && !resolvedName) {
      setAuthModalOpen(true);
    }
  };

  // 1. Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      void syncFirebaseUser(fbUser);
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
            info: typeof data.info === 'string' ? data.info : '',
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

  // 4. Listen to Notifications (Admin only)
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
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
            recipientEmail: String(data.recipientEmail || ''),
            emailStatus:
              (data.emailStatus as AdminNotification['emailStatus']) || 'not_configured',
            read: Boolean(data.read),
            createdAt: tsToIso(data.createdAt),
          };
        });

        list.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
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

  // 8. Listen to comment counts for all characters in real-time
  useEffect(() => {
    if (characters.length === 0) {
      setCommentCounts({});
      return;
    }
    const unsubs = characters.map((c) => {
      const path = `characters/${c.id}/comments`;
      return onSnapshot(
        collection(db, path),
        (snap) => {
          setCommentCounts((prev) => ({
            ...prev,
            [c.id]: snap.size,
          }));
        },
        () => {
          // ignore offline error
        }
      );
    });
    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [characters]);

  // 9. Listen to Community Chats
  useEffect(() => {
    const q = query(collection(db, 'community_chats'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: CommunityChatMessage[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            authorUid: String(data.authorUid || ''),
            authorName: String(data.authorName || ''),
            characterId: String(data.characterId || 'general'),
            characterName: String(data.characterName || 'Góp ý chung'),
            tag: String(data.tag || '💬 Góp ý'),
            content: String(data.content || ''),
            createdAt: tsToIso(data.createdAt),
          };
        });
        setChatMessages(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'community_chats');
      }
    );
    return () => unsub();
  }, []);

  const pickNextTrack = (
    list: MusicTrack[],
    activeId: string,
    shuffle: boolean
  ): MusicTrack | null => {
    if (list.length === 0) return null;
    if (shuffle && list.length > 1) {
      const candidates = list.filter((t) => t.id !== activeId);
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    const idx = list.findIndex((t) => t.id === activeId);
    return list[(idx + 1) % list.length];
  };

  const pickPrevTrack = (
    list: MusicTrack[],
    activeId: string,
    shuffle: boolean
  ): MusicTrack | null => {
    if (list.length === 0) return null;
    if (shuffle && list.length > 1) {
      const candidates = list.filter((t) => t.id !== activeId);
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    const idx = list.findIndex((t) => t.id === activeId);
    if (idx <= 0) return list[list.length - 1];
    return list[idx - 1];
  };

  useEffect(() => {
    soundEngine.setOnTrackEnded(() => {
      const list = tracksRef.current;
      const next = pickNextTrack(list, currentTrackIdRef.current, isShuffleRef.current);
      if (!next) {
        setIsPlayingMusic(false);
        return;
      }
      setCurrentTrackId(next.id);
      soundEngine.playTrack(next);
      setIsPlayingMusic(true);
    });
    soundEngine.setOnPlaybackChange((playing) => {
      setIsPlayingMusic(playing);
    });
    soundEngine.setMediaControls({
      onPlay: () => {
        const list = tracksRef.current;
        const active =
          list.find((t) => t.id === currentTrackIdRef.current) || list[0];
        if (!active) return;
        if (!currentTrackIdRef.current) {
          setCurrentTrackId(active.id);
        }
        soundEngine.resumeOrPlayTrack(active);
        setIsPlayingMusic(true);
        setHasAutoStarted(true);
      },
      onPause: () => {
        soundEngine.pauseMusic();
        setIsPlayingMusic(false);
      },
      onStop: () => {
        soundEngine.stopMusic();
        setIsPlayingMusic(false);
      },
      onNext: () => {
        const list = tracksRef.current;
        const next = pickNextTrack(list, currentTrackIdRef.current, isShuffleRef.current);
        if (!next) return;
        setCurrentTrackId(next.id);
        soundEngine.playTrack(next);
        setIsPlayingMusic(true);
        setHasAutoStarted(true);
      },
      onPrev: () => {
        const list = tracksRef.current;
        const prev = pickPrevTrack(list, currentTrackIdRef.current, isShuffleRef.current);
        if (!prev) return;
        setCurrentTrackId(prev.id);
        soundEngine.playTrack(prev);
        setIsPlayingMusic(true);
        setHasAutoStarted(true);
      },
    });
    return () => {
      soundEngine.setOnTrackEnded(null);
      soundEngine.setOnPlaybackChange(null);
      soundEngine.setMediaControls(null);
    };
  }, []);

  // First-click autoplay
  useEffect(() => {
    if (hasAutoStarted) return;
    const handleFirstPointer = () => {
      if (hasAutoStarted) return;
      const list = tracksRef.current;
      const firstTrack =
        list.find((t) => t.id === currentTrackId) ||
        (isShuffleRef.current && list.length > 1
          ? list[Math.floor(Math.random() * list.length)]
          : list[0]);
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

  useEffect(() => {
    if (!currentTrack) {
      soundEngine.syncMediaSession(null, false);
      return;
    }
    if (isPlayingMusic || soundEngine.isPlaying()) {
      soundEngine.syncMediaSession(currentTrack, isPlayingMusic);
    }
  }, [currentTrack, isPlayingMusic]);

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

  const topCharacters = useMemo(() => {
    return [...characters].sort((a, b) => {
      const diffLikes = (b.likesCount ?? 0) - (a.likesCount ?? 0);
      if (diffLikes !== 0) return diffLikes;
      const diffViews = (b.viewsCount ?? 0) - (a.viewsCount ?? 0);
      if (diffViews !== 0) return diffViews;
      const diffComments = (commentCounts[b.id] ?? 0) - (commentCounts[a.id] ?? 0);
      if (diffComments !== 0) return diffComments;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [characters, commentCounts]);

  const likedCharacters = useMemo(() => {
    return characters.filter((c) => likedIds.has(c.id));
  }, [characters, likedIds]);

  const selectedCharacter = useMemo(
    () => characters.find((c) => c.id === selectedCharId) || null,
    [characters, selectedCharId]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const notifyAdmin = async (
    type: 'like' | 'comment',
    character: Character,
    message: string
  ) => {
    if (!currentUser) return;
    const notifId =
      type === 'like'
        ? buildLikeNotifId(currentUser.uid, character.id)
        : `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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
        emailStatus: 'not_configured',
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }

    try {
      await fetch('/api/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          characterName: character.name,
          actorName: currentUser.name,
          message,
        }),
      });
    } catch {
      // ignore email webhook failure
    }
  };

  const handleEnterFromIntro = () => {
    setView('gallery');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      soundEngine.unlock();
      soundEngine.playSparkle();
      const first =
        tracks.find((t) => t.id === currentTrackId) ||
        (isShuffle && tracks.length > 1
          ? tracks[Math.floor(Math.random() * tracks.length)]
          : tracks[0]);
      if (first && !isPlayingMusic) {
        soundEngine.playTrack(first);
        setCurrentTrackId(first.id);
        setIsPlayingMusic(true);
        setHasAutoStarted(true);
      }
    } catch {
      // ignore audio playback failure
    }
  };

  const handleNavigate = (nextView: AppView) => {
    soundEngine.playPageTurn();
    setView(nextView);
    window.scrollTo(0, 0);
  };

  const handleNavPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || !navScrollRef.current) return;
    navDragRef.current = {
      isDown: true,
      startX: e.clientX,
      scrollLeft: navScrollRef.current.scrollLeft,
      moved: false,
    };
  };

  const handleNavPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!navDragRef.current.isDown || !navScrollRef.current) return;
    const dx = e.clientX - navDragRef.current.startX;
    if (Math.abs(dx) > 4) {
      navDragRef.current.moved = true;
    }
    if (navDragRef.current.moved) {
      navScrollRef.current.scrollLeft = navDragRef.current.scrollLeft - dx;
    }
  };

  const handleNavPointerEnd = () => {
    navDragRef.current.isDown = false;
    window.setTimeout(() => {
      navDragRef.current.moved = false;
    }, 0);
  };

  const handleNavClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (navDragRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleOpenDetail = async (charId: string) => {
    if (view === 'gallery' || view === 'top' || view === 'liked' || view === 'chat') {
      setPreviousListView(view);
    }
    soundEngine.playPageTurn();
    setActionError(null);
    setSelectedCharId(charId);
    setView('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const charRef = doc(db, 'characters', charId);
    try {
      await updateDoc(charRef, { viewsCount: increment(1) });
    } catch (err) {
      reportActionFailure(
        err,
        OperationType.UPDATE,
        `characters/${charId}`,
        'Không thể cập nhật lượt xem lên Firebase. Vui lòng kiểm tra kết nối hoặc quy tắc bảo mật.'
      );
    }
  };

  const handleTogglePlay = () => {
    soundEngine.playChime();
    if (isPlayingMusic) {
      soundEngine.pauseMusic();
      setIsPlayingMusic(false);
    } else if (currentTrack) {
      soundEngine.resumeOrPlayTrack(currentTrack);
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
    const next = pickNextTrack(tracks, currentTrackId, isShuffle);
    if (!next) return;
    soundEngine.playChime();
    setCurrentTrackId(next.id);
    soundEngine.playTrack(next);
    setIsPlayingMusic(true);
    setHasAutoStarted(true);
  };

  const handleToggleShuffle = () => {
    soundEngine.playChime();
    setIsShuffle((prev) => !prev);
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
    setActionError(null);
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

      if (alreadyLiked) {
        try {
          await deleteDoc(
            doc(db, 'notifications', buildLikeNotifId(currentUser.uid, charId))
          );
        } catch {
          // Ignore if no matching notification exists
        }
      } else if (targetChar) {
        void notifyAdmin(
          'like',
          targetChar,
          `${currentUser.name} đã thả tim cho nhân vật ${targetChar.name}.`
        );
      }
    } catch (err) {
      reportActionFailure(
        err,
        OperationType.WRITE,
        `characters/${charId}/likes/${currentUser.uid}`,
        'Không thể lưu lượt thả tim lên Firebase. Hãy đảm bảo Gmail của bạn đã xác minh.'
      );
    }
  };

  const handleAddComment = async (
    charId: string,
    content: string
  ): Promise<boolean> => {
    if (!currentUser || !currentUser.emailVerified) {
      setAuthModalOpen(true);
      return false;
    }
    setActionError(null);
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
      return true;
    } catch (err) {
      reportActionFailure(
        err,
        OperationType.CREATE,
        path,
        'Không thể gửi lời nhắn lên Firebase. Hãy đảm bảo Gmail của bạn đã xác minh.'
      );
      return false;
    }
  };

  const handleUpdateComment = async (
    charId: string,
    commentId: string,
    content: string
  ) => {
    setActionError(null);
    const path = `characters/${charId}/comments/${commentId}`;
    try {
      await updateDoc(doc(db, path), {
        content: content.slice(0, 500),
        updatedAt: serverTimestamp(),
      });
      soundEngine.playSuccess();
    } catch (err) {
      reportActionFailure(
        err,
        OperationType.UPDATE,
        path,
        'Không thể chỉnh sửa lời nhắn lúc này.'
      );
    }
  };

  const handleDeleteComment = async (charId: string, commentId: string) => {
    setActionError(null);
    const path = `characters/${charId}/comments/${commentId}`;
    try {
      await deleteDoc(doc(db, path));
      soundEngine.playChime();
    } catch (err) {
      reportActionFailure(
        err,
        OperationType.DELETE,
        path,
        'Không thể xoá lời nhắn lúc này.'
      );
    }
  };

  // Community Chat Handlers
  const handleSendChatMessage = async (input: {
    characterId: string;
    characterName: string;
    tag: string;
    content: string;
  }): Promise<boolean> => {
    if (!currentUser || !currentUser.emailVerified) {
      setAuthModalOpen(true);
      return false;
    }
    setActionError(null);
    const chatId = `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const path = `community_chats/${chatId}`;

    try {
      await setDoc(doc(db, path), {
        authorUid: currentUser.uid,
        authorName: currentUser.name.slice(0, 80),
        characterId: input.characterId.slice(0, 128),
        characterName: input.characterName.slice(0, 80),
        tag: input.tag.slice(0, 50),
        content: input.content.slice(0, 500),
        createdAt: serverTimestamp(),
      });
      soundEngine.playSuccess();

      // Always notify admin of new community chat messages (preserved even if deleted later)
      const adminNotifId = `notif_admin_chat_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      void setDoc(doc(db, 'notifications', adminNotifId), {
        type: 'comment',
        characterId: 'general',
        characterName: 'Góp ý chung',
        actorUid: currentUser.uid,
        actorName: currentUser.name.slice(0, 80),
        message: input.content.slice(0, 600),
        recipientEmail: ADMIN_EMAIL,
        emailStatus: 'not_configured',
        read: false,
        createdAt: serverTimestamp(),
      }).catch(() => {});

      return true;
    } catch (err) {
      reportActionFailure(
        err,
        OperationType.CREATE,
        path,
        'Không thể gửi lời nhắn lên Góc Trò Chuyện. Hãy đảm bảo tài khoản đã xác minh Gmail.'
      );
      return false;
    }
  };

  const handleDeleteChatMessage = async (chatId: string) => {
    setActionError(null);
    const path = `community_chats/${chatId}`;
    try {
      await deleteDoc(doc(db, path));
      soundEngine.playChime();
    } catch (err) {
      reportActionFailure(
        err,
        OperationType.DELETE,
        path,
        'Không thể xoá lời nhắn lúc này.'
      );
    }
  };

  // Admin CRUD
  const handleSaveCharacter = async (input: {
    id?: string;
    name: string;
    avatar: string;
    hashtags: string[];
    slogan: string;
    info?: string;
    story: string;
    link: string;
    linkLabel: string;
  }) => {
    setActionError(null);
    const normalizedAvatar = normalizeMediaUrl(input.avatar, 'image').slice(0, 200000);
    const infoValue = typeof input.info === 'string' ? input.info : '';
    if (input.id) {
      const path = `characters/${input.id}`;
      try {
        await updateDoc(doc(db, path), {
          name: input.name,
          avatar: normalizedAvatar,
          hashtags: input.hashtags,
          slogan: input.slogan,
          info: infoValue,
          story: input.story,
          link: input.link,
          linkLabel: input.linkLabel,
          updatedAt: serverTimestamp(),
        });
        soundEngine.playSuccess();
      } catch (err) {
        reportActionFailure(
          err,
          OperationType.UPDATE,
          path,
          'Không thể cập nhật nhân vật. Kiểm tra lại kích thước ảnh hoặc đường dẫn hợp lệ.'
        );
        throw err;
      }
    } else {
      const newId = slugId(input.name);
      const path = `characters/${newId}`;
      try {
        await setDoc(doc(db, path), {
          name: input.name,
          avatar: normalizedAvatar,
          hashtags: input.hashtags,
          slogan: input.slogan,
          info: infoValue,
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
        reportActionFailure(
          err,
          OperationType.CREATE,
          path,
          'Không thể thêm nhân vật mới. Kiểm tra lại ảnh đại diện và thông tin đã nhập.'
        );
        throw err;
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
      reportActionFailure(
        err,
        OperationType.DELETE,
        path,
        'Không thể xoá nhân vật trên Firebase.'
      );
    }
  };

  const deleteTrackChunks = async (trackId: string) => {
    const chunksSnap = await getDocs(collection(db, 'tracks', trackId, 'chunks'));
    if (chunksSnap.empty) return;
    for (let i = 0; i < chunksSnap.docs.length; i += 200) {
      const batch = writeBatch(db);
      chunksSnap.docs.slice(i, i + 200).forEach((d) => batch.delete(d.ref));
      await batch.commit();
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
    pendingAudioFile?: { base64Chunks: string[]; mimeType: string };
    onProgress?: (percent: number) => void;
  }) => {
    setActionError(null);
    const targetId = input.id || slugId(input.title);
    const path = `tracks/${targetId}`;
    const resolvedAudioUrl = input.pendingAudioFile
      ? `chunks:${input.pendingAudioFile.base64Chunks.length}:${input.pendingAudioFile.mimeType}`.slice(
          0,
          500
        )
      : input.audioUrl.startsWith('chunks:')
        ? input.audioUrl.slice(0, 500)
        : normalizeMediaUrl(input.audioUrl, 'audio').slice(0, 500);

    try {
      if (input.id) {
        await updateDoc(doc(db, path), {
          title: input.title,
          artist: input.artist,
          mood: input.mood,
          durationLabel: input.durationLabel,
          audioUrl: resolvedAudioUrl,
          synthPreset: input.synthPreset,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, path), {
          title: input.title,
          artist: input.artist,
          mood: input.mood,
          durationLabel: input.durationLabel,
          audioUrl: resolvedAudioUrl,
          synthPreset: input.synthPreset,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (input.pendingAudioFile) {
        if (input.id) {
          await deleteTrackChunks(targetId);
        }
        const { base64Chunks, mimeType } = input.pendingAudioFile;
        for (let i = 0; i < base64Chunks.length; i += 4) {
          const batch = writeBatch(db);
          const slice = base64Chunks.slice(i, i + 4);
          slice.forEach((data, offset) => {
            const idx = i + offset;
            batch.set(doc(db, 'tracks', targetId, 'chunks', String(idx)), {
              index: idx,
              data,
              mimeType: mimeType.slice(0, 80),
              createdAt: serverTimestamp(),
            });
          });
          await batch.commit();
          input.onProgress?.(
            Math.min(100, Math.round(((i + slice.length) / base64Chunks.length) * 100))
          );
        }
      } else if (input.id && !resolvedAudioUrl.startsWith('chunks:')) {
        await deleteTrackChunks(targetId);
      }

      soundEngine.playSuccess();
    } catch (err) {
      reportActionFailure(
        err,
        input.id ? OperationType.UPDATE : OperationType.CREATE,
        path,
        'Không thể lưu bài nhạc lên Firebase. Kiểm tra lại tệp nhạc hoặc đường dẫn.'
      );
      throw err;
    }
  };

  const handleDeleteTrack = async (id: string) => {
    const path = `tracks/${id}`;
    try {
      await deleteTrackChunks(id);
      await deleteDoc(doc(db, path));
      if (currentTrackId === id) {
        soundEngine.pauseMusic();
        setIsPlayingMusic(false);
        setCurrentTrackId('');
      }
      soundEngine.playChime();
    } catch (err) {
      reportActionFailure(
        err,
        OperationType.DELETE,
        path,
        'Không thể xoá bài nhạc trên Firebase.'
      );
    }
  };

  const handleDeleteAllTracks = async () => {
    if (tracks.length === 0) return;
    try {
      for (const t of tracks) {
        await deleteTrackChunks(t.id);
      }
      const batch = writeBatch(db);
      tracks.forEach((t) => batch.delete(doc(db, 'tracks', t.id)));
      await batch.commit();
      soundEngine.pauseMusic();
      setIsPlayingMusic(false);
      setCurrentTrackId('');
      soundEngine.playChime();
    } catch (err) {
      reportActionFailure(
        err,
        OperationType.DELETE,
        'tracks',
        'Không thể xoá toàn bộ nhạc trên Firebase.'
      );
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const unreadIds = new Set(unread.map((n) => n.id));
    setNotifications((prev) =>
      prev.map((n) => (unreadIds.has(n.id) ? { ...n, read: true } : n))
    );
    try {
      for (let i = 0; i < unread.length; i += 450) {
        const chunk = unread.slice(i, i + 450);
        const batch = writeBatch(db);
        chunk.forEach((n) => {
          batch.update(doc(db, 'notifications', n.id), { read: true });
        });
        await batch.commit();
      }
    } catch {
      await Promise.all(
        unread.map((n) =>
          updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {})
        )
      );
    }
  };

  const handleDeleteNotification = async (id: string) => {
    const path = `notifications/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (err) {
      reportActionFailure(
        err,
        OperationType.DELETE,
        path,
        'Không thể xoá thông báo trên Firebase.'
      );
    }
  };

  const handleDeleteAllNotifications = async () => {
    if (notifications.length === 0) return;
    try {
      for (let i = 0; i < notifications.length; i += 450) {
        const chunk = notifications.slice(i, i + 450);
        const batch = writeBatch(db);
        chunk.forEach((n) => batch.delete(doc(db, 'notifications', n.id)));
        await batch.commit();
      }
      soundEngine.playChime();
    } catch (err) {
      reportActionFailure(
        err,
        OperationType.DELETE,
        'notifications',
        'Không thể xoá toàn bộ thông báo trên Firebase.'
      );
    }
  };

  if (view === 'intro') {
    return (
      <div className="relative min-h-screen w-full max-w-full overflow-x-hidden">
        <IntroPage onEnter={handleEnterFromIntro} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full max-w-full overflow-x-clip bg-[#FFF5F8] text-[#3A071F]">
      <div aria-hidden="true" className="fixed-rabbit-bg select-none">
        <img
          src="/assets/aistudio/b112e43a638cdf3ea1d624c6fe5f0842_3ae26b1b.jpg"
          alt="Nền hoàng hôn thỏ hồng"
          className="pointer-events-none h-full w-full object-cover object-center opacity-40 select-none"
        />
      </div>

      <header className="relative z-30 bg-transparent">
        <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-3 pb-0 sm:gap-6 sm:px-6">
          <button
            type="button"
            onClick={() => handleNavigate('intro')}
            className="font-artistic cursor-pointer rounded-full border border-white/95 bg-[#FFD6E6]/55 px-4 py-1 text-xl font-bold tracking-wide text-[#7A1840] shadow-[0_0_12px_rgba(255,255,255,0.85)] transition-all hover:scale-105 hover:border-white hover:bg-[#FFD6E6]/75 whitespace-nowrap shrink-0 sm:text-2xl"
            style={{
              textShadow: '0 1px 8px rgba(255, 255, 255, 0.95), 0 1px 2px rgba(111, 31, 59, 0.2)',
            }}
          >
            Ăn Kẹo Hong
          </button>

          <div className="flex shrink-0 items-center gap-2">
            {/* Chỉ quản trị viên mới có chuông báo hiệu (lắc + dấu ! khi có thông báo chưa đọc, xem trong mục Quản trị) */}
            {currentUser?.role === 'admin' && (
              <div
                title={
                  unreadNotificationsCount > 0
                    ? 'Có thông báo mới — vào mục Quản trị để xem'
                    : 'Không có thông báo mới'
                }
                aria-label={
                  unreadNotificationsCount > 0
                    ? `Có ${unreadNotificationsCount} thông báo chưa đọc`
                    : 'Không có thông báo mới'
                }
                className="relative inline-flex min-h-[38px] items-center justify-center gap-1 rounded-full border border-white/95 bg-[#FFD6E6]/55 px-3 py-1.5 text-xs font-bold text-[#7A1840] shadow-[0_0_12px_rgba(255,255,255,0.85)] whitespace-nowrap shrink-0 select-none"
              >
                <Bell
                  className={`h-4 w-4 ${
                    unreadNotificationsCount > 0
                      ? 'text-[#E11D48] animate-bell-ring'
                      : 'text-[#7A1840]'
                  }`}
                />
                {unreadNotificationsCount > 0 && (
                  <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E11D48] px-1 text-[10px] font-black leading-none text-white shadow-[0_0_8px_rgba(225,29,72,0.9)] animate-pulse">
                    !
                  </span>
                )}
              </div>
            )}

            {currentUser ? (
              <div className="flex items-center gap-2">
                {!currentUser.emailVerified && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playChime();
                      setAuthModalOpen(true);
                    }}
                    className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-full border border-white/95 bg-[#6F1F3B] px-3 py-1 text-[11px] font-bold text-[#FFF0F5] shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-colors whitespace-nowrap hover:bg-[#3A071F]"
                  >
                    <MailWarning className="h-3.5 w-3.5" />
                    <span>Xác minh Gmail</span>
                  </button>
                )}
                <span className="hidden max-w-[150px] truncate rounded-full border border-white/90 bg-white/40 px-3 py-1 text-xs font-semibold text-[#5E1131] shadow-[0_0_10px_rgba(255,255,255,0.75)] sm:inline-flex sm:items-center sm:gap-1">
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
                    try {
                      localStorage.removeItem('candy_pending_nickname');
                    } catch {
                      // ignore
                    }
                    await signOut(auth);
                    if (view === 'admin') setView('gallery');
                  }}
                  aria-label="Đăng xuất"
                  className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-white/95 bg-[#FFD6E6]/55 px-3.5 py-1.5 text-xs font-semibold text-[#5E1131] shadow-[0_0_12px_rgba(255,255,255,0.85)] transition-all whitespace-nowrap shrink-0 hover:border-white hover:bg-[#3A071F] hover:text-[#FFF0F5]"
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
                className="inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-full border border-white/95 bg-[#FFD6E6]/55 px-4 py-1.5 text-xs font-bold text-[#7A1840] shadow-[0_0_12px_rgba(255,255,255,0.85)] transition-all whitespace-nowrap shrink-0 hover:border-white hover:bg-[#FFD6E6]/75"
              >
                Đăng nhập
              </button>
            )}
          </div>
        </div>

        {/* Dòng ngăn cách nằm giữa hàng Ăn Kẹo Hong / Đăng nhập và hàng điều hướng bên dưới */}
        <div
          aria-hidden="true"
          className="relative z-10 flex items-center justify-center py-6 select-none sm:py-7"
        >
          <span
            className="text-base leading-none font-bold tracking-[0.35em] text-white sm:text-lg"
            style={{
              paintOrder: 'stroke fill',
              WebkitTextStroke: '1.5px #B81D5B',
              textShadow:
                '0 0 8px rgba(255, 255, 255, 0.98), 0 0 16px rgba(255, 255, 255, 0.85)',
            }}
          >
            ✦ · ✦ · ✦
          </span>
        </div>

        <nav
          ref={navScrollRef}
          aria-label="Điều hướng chính"
          onPointerDown={handleNavPointerDown}
          onPointerMove={handleNavPointerMove}
          onPointerUp={handleNavPointerEnd}
          onPointerCancel={handleNavPointerEnd}
          onPointerLeave={handleNavPointerEnd}
          onClickCapture={handleNavClickCapture}
          className="relative z-10 mx-auto w-full max-w-6xl cursor-grab overflow-x-auto px-3 py-0 select-none active:cursor-grabbing sm:px-6"
        >
          <div className="mx-auto flex w-max flex-nowrap items-center gap-2 text-xs font-semibold text-[#6F1F3B] sm:gap-2.5 sm:text-sm">
            <button
              type="button"
              onClick={() => handleNavigate('gallery')}
              className={`cursor-pointer rounded-full border px-3 py-1 transition-all whitespace-nowrap shrink-0 sm:px-3.5 sm:py-1.5 ${
                view === 'gallery' || (view === 'detail' && previousListView === 'gallery')
                  ? 'border-white bg-white/75 text-[#3A071F] shadow-[0_0_14px_rgba(255,255,255,0.95)]'
                  : 'border-white/90 bg-white/35 text-[#5E1131] shadow-[0_0_10px_rgba(255,255,255,0.75)] hover:border-white hover:bg-white/65 hover:text-[#3A071F]'
              }`}
            >
              Nhân Vật
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('top')}
              title="Top nhân vật được yêu thích nhất"
              className={`cursor-pointer rounded-full border px-3 py-1 transition-all whitespace-nowrap shrink-0 sm:px-3.5 sm:py-1.5 ${
                view === 'top' || (view === 'detail' && previousListView === 'top')
                  ? 'border-white bg-white/75 text-[#3A071F] shadow-[0_0_14px_rgba(255,255,255,0.95)]'
                  : 'border-white/90 bg-white/35 text-[#5E1131] shadow-[0_0_10px_rgba(255,255,255,0.75)] hover:border-white hover:bg-white/65 hover:text-[#3A071F]'
              }`}
            >
              Top Yêu Thích
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('chat')}
              className={`cursor-pointer rounded-full border px-3 py-1 transition-all whitespace-nowrap shrink-0 sm:px-3.5 sm:py-1.5 ${
                view === 'chat' || (view === 'detail' && previousListView === 'chat')
                  ? 'border-white bg-white/75 text-[#3A071F] shadow-[0_0_14px_rgba(255,255,255,0.95)]'
                  : 'border-white/90 bg-white/35 text-[#5E1131] shadow-[0_0_10px_rgba(255,255,255,0.75)] hover:border-white hover:bg-white/65 hover:text-[#3A071F]'
              }`}
            >
              Trò Chuyện
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('music')}
              className={`cursor-pointer rounded-full border px-3 py-1 transition-all whitespace-nowrap shrink-0 sm:px-3.5 sm:py-1.5 ${
                view === 'music'
                  ? 'border-white bg-white/75 text-[#3A071F] shadow-[0_0_14px_rgba(255,255,255,0.95)]'
                  : 'border-white/90 bg-white/35 text-[#5E1131] shadow-[0_0_10px_rgba(255,255,255,0.75)] hover:border-white hover:bg-white/65 hover:text-[#3A071F]'
              }`}
            >
              Âm Nhạc
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('liked')}
              className={`cursor-pointer rounded-full border px-3 py-1 transition-all whitespace-nowrap shrink-0 sm:px-3.5 sm:py-1.5 ${
                view === 'liked' || (view === 'detail' && previousListView === 'liked')
                  ? 'border-white bg-white/75 text-[#3A071F] shadow-[0_0_14px_rgba(255,255,255,0.95)]'
                  : 'border-white/90 bg-white/35 text-[#5E1131] shadow-[0_0_10px_rgba(255,255,255,0.75)] hover:border-white hover:bg-white/65 hover:text-[#3A071F]'
              }`}
            >
              Đã Thích
            </button>
            {currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={() => handleNavigate('admin')}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 transition-all whitespace-nowrap shrink-0 sm:px-3.5 sm:py-1.5 ${
                  view === 'admin'
                    ? 'border-white bg-white/75 text-[#3A071F] shadow-[0_0_14px_rgba(255,255,255,0.95)]'
                    : 'border-white/90 bg-white/35 text-[#5E1131] shadow-[0_0_10px_rgba(255,255,255,0.75)] hover:border-white hover:bg-white/65 hover:text-[#3A071F]'
                }`}
              >
                <span>Quản Trị</span>
                {unreadNotificationsCount > 0 && (
                  <span className="rounded-full bg-[#6F1F3B] px-1.5 py-0.5 text-[10px] font-bold text-[#FFF0F5] tabular-nums sm:px-2 sm:text-[11px]">
                    {unreadNotificationsCount} mới
                  </span>
                )}
              </button>
            )}
          </div>
        </nav>
      </header>

      <main className="relative z-20 pt-6 sm:pt-7">
        {actionError && (
          <div className="mx-auto mb-4 w-full max-w-4xl px-4 sm:px-6">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#6F1F3B]/35 bg-white/95 px-4 py-3 text-xs font-semibold text-[#6F1F3B] shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-[#6F1F3B]" />
                <span>{actionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                aria-label="Đóng thông báo lỗi"
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-[#E2A6BA]/30"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        {view === 'gallery' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="mx-auto w-full max-w-6xl px-4 pb-28 sm:px-6"
          >
            <div className="mb-8 flex flex-col items-center text-center">
              <h1
                className="font-artistic mb-3 text-4xl font-bold tracking-wide text-[#A8184B] sm:text-6xl"
                style={{
                  textWrap: 'balance',
                  textShadow:
                    '0 2px 14px rgba(255, 255, 255, 0.98), 0 0 24px rgba(255, 240, 245, 0.95), 0 2px 4px rgba(168, 24, 75, 0.2)',
                }}
              >
                Xem Và Mua Kẹo Nha
              </h1>
              <div className="inline-flex items-center gap-3 rounded-full border border-[#B65A7C]/25 bg-white/80 px-5 py-1.5 shadow-sm backdrop-blur-sm">
                <span aria-hidden="true" className="hidden h-px w-5 bg-[#B65A7C]/60 sm:block" />
                <p className="text-xs font-semibold text-[#5E1131] sm:text-sm">
                  Giữa muôn vàn cuộc gặp gỡ ngoài kia, cảm ơn vì bạn đã ghé qua nơi này 🌷❤️
                </p>
                <span aria-hidden="true" className="hidden h-px w-5 bg-[#B65A7C]/60 sm:block" />
              </div>
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

              <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto py-1 whitespace-nowrap scrollbar-none select-none">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playChime();
                    setActiveHashtag('all');
                  }}
                  className={`min-h-[38px] shrink-0 cursor-pointer rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                    activeHashtag === 'all'
                      ? 'border-[#DDD6FE] bg-[#EDE9FE] text-[#5B21B6] shadow-sm'
                      : 'border-transparent bg-white/75 text-[#6F1F3B] hover:bg-white'
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
                    className={`min-h-[38px] shrink-0 cursor-pointer rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                      activeHashtag === tag
                        ? 'border-[#DDD6FE] bg-[#EDE9FE] text-[#5B21B6] shadow-sm'
                        : 'border-transparent bg-white/75 text-[#6F1F3B] hover:bg-white'
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
                      <article className="mx-auto flex h-full w-full max-w-[305px] flex-col overflow-hidden rounded-2xl border-[1.5px] border-white/95 bg-transparent text-center shadow-[0_0_14px_rgba(255,255,255,0.75)] transition-shadow duration-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.95)]">
                        <div className="mx-auto mt-4 w-[72%] max-w-[210px]">
                          <AvatarFrame src={char.avatar} alt={char.name} size="card" />
                        </div>

                        <div className="flex flex-1 flex-col items-center bg-transparent px-4 pt-3.5 pb-4 text-center">
                          <h2
                            className="font-cute mb-2.5 text-2xl font-extrabold tracking-tight text-[#5E0B33]"
                            style={{
                              paintOrder: 'stroke fill',
                              WebkitTextStroke: '3.5px #FFFFFF',
                              textShadow:
                                '0 0 10px rgba(255, 255, 255, 0.98), 0 2px 6px rgba(94, 11, 51, 0.25)',
                            }}
                          >
                            {char.name}
                          </h2>

                          {char.hashtags.length > 0 && (
                            <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
                              {char.hashtags.map((tag, idx) => (
                                <span
                                  key={tag}
                                  className={`inline-flex items-center rounded-full border-[1.5px] border-white px-2.5 py-0.5 text-[11px] font-bold shadow-[0_0_8px_rgba(255,255,255,0.98),0_0_14px_rgba(255,255,255,0.75),0_2px_6px_rgba(40,60,90,0.12)] ${getPastelTagClass(
                                    idx
                                  )}`}
                                >
                                  #{tag.replace(/^#/, '')}
                                </span>
                              ))}
                            </div>
                          )}

                          <p
                            className={`mb-4 w-full rounded-2xl px-3.5 py-2 text-xs leading-relaxed font-semibold ${SLOGAN_BOX_CLASS}`}
                          >
                            <span>“{char.slogan}”</span>
                          </p>

                          <div
                            className="mt-auto flex w-full flex-nowrap items-center justify-center gap-3 border-t border-white/75 pt-3.5 text-xs font-bold text-[#4A0A28]"
                            style={{
                              textShadow:
                                '0 0 8px rgba(255, 255, 255, 0.98), 0 0 3px rgba(255, 255, 255, 1)',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => void handleToggleLike(char.id)}
                              aria-label={`Thả tim cho ${char.name}`}
                              className="inline-flex min-h-[34px] shrink-0 cursor-pointer items-center gap-1 transition-transform hover:scale-105"
                            >
                              <Heart
                                className={`h-4 w-4 drop-shadow-[0_0_4px_rgba(255,255,255,0.95)] ${
                                  isLiked
                                    ? 'fill-[#6F1F3B] text-[#6F1F3B]'
                                    : 'text-[#8C1B4A]'
                                }`}
                              />
                              <span className="tabular-nums">{char.likesCount}</span>
                            </button>

                            <span
                              className="inline-flex shrink-0 items-center gap-1"
                              title="Lượt xem"
                            >
                              <Eye className="h-4 w-4 text-[#8C1B4A] drop-shadow-[0_0_4px_rgba(255,255,255,0.95)]" />
                              <span className="tabular-nums">{char.viewsCount}</span>
                            </span>

                            <button
                              type="button"
                              onClick={() => void handleOpenDetail(char.id)}
                              aria-label={`Xem ${commentCounts[char.id] ?? 0} lời nhắn`}
                              title="Lời nhắn"
                              className="inline-flex min-h-[34px] shrink-0 cursor-pointer items-center gap-1 transition-transform hover:scale-105 hover:text-[#3A071F]"
                            >
                              <MessageCircle className="h-4 w-4 text-[#8C1B4A] drop-shadow-[0_0_4px_rgba(255,255,255,0.95)]" />
                              <span className="tabular-nums">{commentCounts[char.id] ?? 0}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleOpenDetail(char.id)}
                              className="min-h-[34px] shrink-0 cursor-pointer rounded-full border border-white/95 bg-[#6F1F3B] px-3.5 py-1 text-xs font-bold text-[#FFF0F5] shadow-[0_0_10px_rgba(255,255,255,0.85)] transition-colors hover:bg-[#3A071F] whitespace-nowrap"
                              style={{ textShadow: 'none' }}
                            >
                              Chi tiết
                            </button>
                          </div>
                        </div>
                      </article>
                    </Tilt3DCard>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {view === 'top' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="mx-auto w-full max-w-6xl px-4 pb-28 sm:px-6"
          >
            <div className="mb-8 text-center">
              <h1
                className="font-artistic text-3xl font-bold tracking-wide text-[#5B1F78] sm:text-5xl"
                style={{
                  textShadow:
                    '0 2px 14px rgba(255, 255, 255, 0.98), 0 0 24px rgba(255, 240, 245, 0.95), 0 2px 4px rgba(91, 31, 120, 0.2)',
                }}
              >
                Top Nhân Vật Được Yêu Thích Nhất
              </h1>
            </div>

            {loadingChars ? (
              <div className="flex justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#B65A7C]/30 border-t-[#6F1F3B]" />
              </div>
            ) : topCharacters.length === 0 ? (
              <div className="rounded-3xl border border-[#B65A7C]/25 bg-[#FFF0F5]/80 p-12 text-center text-[#6F1F3B] shadow-sm">
                <p className="text-sm font-semibold">Chưa có nhân vật nào trong danh sách.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {topCharacters.map((char, index) => {
                  const isLiked = likedIds.has(char.id);
                  const rank = index + 1;

                  return (
                    <Tilt3DCard
                      key={char.id}
                      onHoverSound={() => soundEngine.playHoverTick()}
                      className="group"
                    >
                      <article className="relative mx-auto flex h-full w-full max-w-[305px] flex-col overflow-hidden rounded-2xl border-[1.5px] border-white/95 bg-transparent text-center shadow-[0_0_14px_rgba(255,255,255,0.75)] transition-shadow duration-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.95)]">
                        {/* Rank Badge */}
                        <div className="absolute top-3 left-3 z-10">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border border-white/90 px-3 py-1 text-xs font-black shadow-md ${
                              rank === 1
                                ? 'bg-gradient-to-r from-[#FEF08A] via-[#FDE047] to-[#F59E0B] text-[#78350F]'
                                : rank === 2
                                ? 'bg-gradient-to-r from-[#F8FAFC] via-[#E2E8F0] to-[#CBD5E1] text-[#334155]'
                                : rank === 3
                                ? 'bg-gradient-to-r from-[#FED7AA] via-[#FDBA74] to-[#FB923C] text-[#7C2D12]'
                                : 'bg-white/90 text-[#6F1F3B]'
                            }`}
                          >
                            {rank === 1 && (
                              <Crown className="h-3.5 w-3.5 fill-[#CA8A04] text-[#78350F]" />
                            )}
                            {rank === 2 && (
                              <Crown className="h-3.5 w-3.5 fill-[#94A3B8] text-[#334155]" />
                            )}
                            {rank === 3 && (
                              <Crown className="h-3.5 w-3.5 fill-[#EA580C] text-[#7C2D12]" />
                            )}
                            <span>#{rank}</span>
                          </span>
                        </div>

                        <div className="mx-auto mt-4 w-[72%] max-w-[210px]">
                          <AvatarFrame src={char.avatar} alt={char.name} size="card" />
                        </div>

                        <div className="flex flex-1 flex-col items-center bg-transparent px-4 pt-3.5 pb-4 text-center">
                          <h2
                            className="font-cute mb-2.5 text-2xl font-extrabold tracking-tight text-[#5E0B33]"
                            style={{
                              paintOrder: 'stroke fill',
                              WebkitTextStroke: '3.5px #FFFFFF',
                              textShadow:
                                '0 0 10px rgba(255, 255, 255, 0.98), 0 2px 6px rgba(94, 11, 51, 0.25)',
                            }}
                          >
                            {char.name}
                          </h2>

                          {char.hashtags.length > 0 && (
                            <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
                              {char.hashtags.map((tag, idx) => (
                                <span
                                  key={tag}
                                  className={`inline-flex items-center rounded-full border-[1.5px] border-white px-2.5 py-0.5 text-[11px] font-bold shadow-[0_0_8px_rgba(255,255,255,0.98),0_0_14px_rgba(255,255,255,0.75),0_2px_6px_rgba(40,60,90,0.12)] ${getPastelTagClass(
                                    idx
                                  )}`}
                                >
                                  #{tag.replace(/^#/, '')}
                                </span>
                              ))}
                            </div>
                          )}

                          <p
                            className={`mb-4 w-full rounded-2xl px-3.5 py-2 text-xs leading-relaxed font-semibold ${SLOGAN_BOX_CLASS}`}
                          >
                            <span>“{char.slogan}”</span>
                          </p>

                          <div
                            className="mt-auto flex w-full flex-nowrap items-center justify-center gap-3 border-t border-white/75 pt-3.5 text-xs font-bold text-[#4A0A28]"
                            style={{
                              textShadow:
                                '0 0 8px rgba(255, 255, 255, 0.98), 0 0 3px rgba(255, 255, 255, 1)',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => void handleToggleLike(char.id)}
                              aria-label={`Thả tim cho ${char.name}`}
                              className="inline-flex min-h-[34px] shrink-0 cursor-pointer items-center gap-1 transition-transform hover:scale-105"
                            >
                              <Heart
                                className={`h-4 w-4 drop-shadow-[0_0_4px_rgba(255,255,255,0.95)] ${
                                  isLiked
                                    ? 'fill-[#6F1F3B] text-[#6F1F3B]'
                                    : 'text-[#8C1B4A]'
                                }`}
                              />
                              <span className="tabular-nums">{char.likesCount}</span>
                            </button>

                            <span
                              className="inline-flex shrink-0 items-center gap-1"
                              title="Lượt xem"
                            >
                              <Eye className="h-4 w-4 text-[#8C1B4A] drop-shadow-[0_0_4px_rgba(255,255,255,0.95)]" />
                              <span className="tabular-nums">{char.viewsCount}</span>
                            </span>

                            <button
                              type="button"
                              onClick={() => void handleOpenDetail(char.id)}
                              aria-label={`Xem ${commentCounts[char.id] ?? 0} lời nhắn`}
                              title="Lời nhắn"
                              className="inline-flex min-h-[34px] shrink-0 cursor-pointer items-center gap-1 transition-transform hover:scale-105 hover:text-[#3A071F]"
                            >
                              <MessageCircle className="h-4 w-4 text-[#8C1B4A] drop-shadow-[0_0_4px_rgba(255,255,255,0.95)]" />
                              <span className="tabular-nums">{commentCounts[char.id] ?? 0}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleOpenDetail(char.id)}
                              className="min-h-[34px] shrink-0 cursor-pointer rounded-full border border-white/95 bg-[#6F1F3B] px-3.5 py-1 text-xs font-bold text-[#FFF0F5] shadow-[0_0_10px_rgba(255,255,255,0.85)] transition-colors hover:bg-[#3A071F] whitespace-nowrap"
                              style={{ textShadow: 'none' }}
                            >
                              Chi tiết
                            </button>
                          </div>
                        </div>
                      </article>
                    </Tilt3DCard>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {view === 'liked' && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mx-auto max-w-6xl px-4 pb-28 sm:px-6"
          >
            <div className="mb-8 text-center">
              <h1
                className="font-artistic text-3xl font-bold tracking-wide text-[#1B4B72] sm:text-5xl"
                style={{
                  textShadow:
                    '0 2px 14px rgba(255, 255, 255, 0.98), 0 0 24px rgba(255, 240, 245, 0.95), 0 2px 4px rgba(27, 75, 114, 0.2)',
                }}
              >
                Nhân Vật Đã Thích
              </h1>
            </div>

            {!currentUser ? (
              <div className="mx-auto max-w-md rounded-3xl border border-white/95 bg-[#FFF0F5]/85 p-8 text-center shadow-[0_0_14px_rgba(255,255,255,0.75)] backdrop-blur-sm">
                <p className="mb-4 text-sm font-semibold text-[#5E1131]">
                  Hãy đăng nhập để lưu và xem lại các nhân vật bạn đã thả tim nhé.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playChime();
                    setAuthModalOpen(true);
                  }}
                  className="inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-full border border-white/95 bg-[#FFD6E6]/70 px-6 py-2 text-xs font-bold text-[#7A1840] shadow-[0_0_12px_rgba(255,255,255,0.85)] transition-all hover:bg-[#FFD6E6]"
                >
                  Đăng nhập
                </button>
              </div>
            ) : loadingChars ? (
              <div className="flex justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#B65A7C]/30 border-t-[#6F1F3B]" />
              </div>
            ) : likedCharacters.length === 0 ? (
              <div className="mx-auto max-w-md rounded-3xl border border-white/95 bg-[#FFF0F5]/85 p-8 text-center shadow-[0_0_14px_rgba(255,255,255,0.75)] backdrop-blur-sm">
                <p className="mb-4 text-sm font-semibold text-[#5E1131]">
                  Bạn chưa thích nhân vật nào hết nè.
                </p>
                <button
                  type="button"
                  onClick={() => handleNavigate('gallery')}
                  className="inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-full border border-[#DDD6FE] bg-[#EDE9FE] px-6 py-2 text-xs font-bold text-[#5B21B6] shadow-sm transition-colors hover:bg-[#DDD6FE]"
                >
                  Xem nhân vật ngay
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {likedCharacters.map((char) => {
                  const isLiked = likedIds.has(char.id);

                  return (
                    <Tilt3DCard
                      key={char.id}
                      onHoverSound={() => soundEngine.playHoverTick()}
                      className="group"
                    >
                      <article className="mx-auto flex h-full w-full max-w-[305px] flex-col overflow-hidden rounded-2xl border-[1.5px] border-white/95 bg-transparent text-center shadow-[0_0_14px_rgba(255,255,255,0.75)] transition-shadow duration-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.95)]">
                        <div className="mx-auto mt-4 w-[72%] max-w-[210px]">
                          <AvatarFrame src={char.avatar} alt={char.name} size="card" />
                        </div>

                        <div className="flex flex-1 flex-col items-center bg-transparent px-4 pt-3.5 pb-4 text-center">
                          <h2
                            className="font-cute mb-2.5 text-2xl font-extrabold tracking-tight text-[#5E0B33]"
                            style={{
                              paintOrder: 'stroke fill',
                              WebkitTextStroke: '3.5px #FFFFFF',
                              textShadow:
                                '0 0 10px rgba(255, 255, 255, 0.98), 0 2px 6px rgba(94, 11, 51, 0.25)',
                            }}
                          >
                            {char.name}
                          </h2>

                          {char.hashtags.length > 0 && (
                            <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
                              {char.hashtags.map((tag, idx) => (
                                <span
                                  key={tag}
                                  className={`inline-flex items-center rounded-full border-[1.5px] border-white px-2.5 py-0.5 text-[11px] font-bold shadow-[0_0_8px_rgba(255,255,255,0.98),0_0_14px_rgba(255,255,255,0.75),0_2px_6px_rgba(40,60,90,0.12)] ${getPastelTagClass(
                                    idx
                                  )}`}
                                >
                                  #{tag.replace(/^#/, '')}
                                </span>
                              ))}
                            </div>
                          )}

                          <p
                            className={`mb-4 w-full rounded-2xl px-3.5 py-2 text-xs leading-relaxed font-semibold ${SLOGAN_BOX_CLASS}`}
                          >
                            <span>“{char.slogan}”</span>
                          </p>

                          <div
                            className="mt-auto flex w-full flex-nowrap items-center justify-center gap-3 border-t border-white/75 pt-3.5 text-xs font-bold text-[#4A0A28]"
                            style={{
                              textShadow:
                                '0 0 8px rgba(255, 255, 255, 0.98), 0 0 3px rgba(255, 255, 255, 1)',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => void handleToggleLike(char.id)}
                              aria-label={`Bỏ thả tim cho ${char.name}`}
                              className="inline-flex min-h-[34px] shrink-0 cursor-pointer items-center gap-1 transition-transform hover:scale-105"
                            >
                              <Heart
                                className={`h-4 w-4 drop-shadow-[0_0_4px_rgba(255,255,255,0.95)] ${
                                  isLiked
                                    ? 'fill-[#6F1F3B] text-[#6F1F3B]'
                                    : 'text-[#8C1B4A]'
                                }`}
                              />
                              <span className="tabular-nums">{char.likesCount}</span>
                            </button>

                            <span
                              className="inline-flex shrink-0 items-center gap-1"
                              title="Lượt xem"
                            >
                              <Eye className="h-4 w-4 text-[#8C1B4A] drop-shadow-[0_0_4px_rgba(255,255,255,0.95)]" />
                              <span className="tabular-nums">{char.viewsCount}</span>
                            </span>

                            <button
                              type="button"
                              onClick={() => void handleOpenDetail(char.id)}
                              aria-label={`Xem ${commentCounts[char.id] ?? 0} lời nhắn`}
                              title="Lời nhắn"
                              className="inline-flex min-h-[34px] shrink-0 cursor-pointer items-center gap-1 transition-transform hover:scale-105 hover:text-[#3A071F]"
                            >
                              <MessageCircle className="h-4 w-4 text-[#8C1B4A] drop-shadow-[0_0_4px_rgba(255,255,255,0.95)]" />
                              <span className="tabular-nums">{commentCounts[char.id] ?? 0}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleOpenDetail(char.id)}
                              className="min-h-[34px] shrink-0 cursor-pointer rounded-full border border-white/95 bg-[#6F1F3B] px-3.5 py-1 text-xs font-bold text-[#FFF0F5] shadow-[0_0_10px_rgba(255,255,255,0.85)] transition-colors hover:bg-[#3A071F] whitespace-nowrap"
                              style={{ textShadow: 'none' }}
                            >
                              Chi tiết
                            </button>
                          </div>
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
            onBack={() => handleNavigate(previousListView)}
            onToggleLike={handleToggleLike}
            onAddComment={handleAddComment}
            onUpdateComment={handleUpdateComment}
            onDeleteComment={handleDeleteComment}
            onRequestAuth={() => setAuthModalOpen(true)}
            onPlayHoverSound={() => soundEngine.playHoverTick()}
          />
        )}

        {view === 'chat' && (
          <ChatPage
            chatMessages={chatMessages}
            currentUser={currentUser}
            onSendChatMessage={handleSendChatMessage}
            onDeleteChatMessage={handleDeleteChatMessage}
            onRequestAuth={() => setAuthModalOpen(true)}
            onPlayHoverSound={() => soundEngine.playHoverTick()}
          />
        )}

        {view === 'music' && (
          <MusicPage
            tracks={tracks}
            currentTrackId={currentTrackId}
            isPlaying={isPlayingMusic}
            isShuffle={isShuffle}
            sfxEnabled={sfxEnabled}
            onSelectTrack={handleSelectTrack}
            onTogglePlay={handleTogglePlay}
            onNextTrack={handleNextTrack}
            onToggleShuffle={handleToggleShuffle}
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
            onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
            onDeleteNotification={handleDeleteNotification}
            onDeleteAllNotifications={handleDeleteAllNotifications}
            onSeedDefaults={handleSeedDefaults}
          />
        )}
      </main>

      <MusicDock
        currentTrack={currentTrack}
        isPlaying={isPlayingMusic}
        isShuffle={isShuffle}
        sfxEnabled={sfxEnabled}
        onTogglePlay={handleTogglePlay}
        onNextTrack={handleNextTrack}
        onToggleShuffle={handleToggleShuffle}
        onToggleSfx={handleToggleSfx}
        onOpenMusicPage={() => handleNavigate('music')}
      />

      <AuthModal
        isOpen={authModalOpen}
        currentUser={currentUser}
        onRefreshAuth={(explicitNickname) => {
          void syncFirebaseUser(auth.currentUser, explicitNickname);
        }}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}
