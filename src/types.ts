export type AppView = 'intro' | 'gallery' | 'detail' | 'music' | 'admin';

export interface CharacterComment {
  id: string;
  characterId: string;
  authorUid: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  name: string;
  avatar: string;
  hashtags: string[];
  slogan: string;
  story: string;
  link: string;
  linkLabel: string;
  likesCount: number;
  viewsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  mood: string;
  durationLabel: string;
  audioUrl: string;
  synthPreset: 'rose_waltz' | 'cotton_lullaby' | 'velvet_nocturne' | 'petal_breeze';
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminNotification {
  id: string;
  type: 'like' | 'comment';
  characterId: string;
  characterName: string;
  actorUid: string;
  actorName: string;
  message: string;
  recipientEmail: string;
  emailStatus: 'sent' | 'queued' | 'not_configured';
  read: boolean;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: 'admin' | 'viewer';
}
