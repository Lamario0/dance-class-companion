export interface DanceClass {
  id: string;
  name: string;
  content: string;
  notes: string;
}

export interface VideoItem {
  id: string;
  title: string;
  url: string;
  category: 'tutorial' | 'month';
}

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  url: string;
  category: 'new' | 'blues' | 'practice';
}

export interface Announcement {
  id: string;
  date: string;
  text: string;
}

export interface AppData {
  classes: DanceClass[];
  videos: VideoItem[];
  songs: SongItem[];
  announcements: Announcement[];
}

export enum Tab {
  CLASSES = 'CLASSES',
  MEDIA = 'MEDIA',
  ANNOUNCEMENTS = 'ANNOUNCEMENTS',
  SETTINGS = 'SETTINGS'
}

export interface AIResponse {
  explanation: string;
}