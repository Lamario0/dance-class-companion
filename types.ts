
export interface DanceClass {
  id: string;
  name: string;
  /** the slot's day/time (slice 3A), e.g. "Tue 7:00pm" */
  when?: string;
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
  details?: string;
  color?: string;
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
  SETTINGS = 'SETTINGS',
  CALCULATOR = 'CALCULATOR',
  /** reached from the left menu, not nav tabs */
  NOTES = 'NOTES',
  STUDENTS = 'STUDENTS',
  SLOTS = 'SLOTS',
  ATTENDANCE = 'ATTENDANCE',
  /** admins: who came to each class (attendance slice 2) */
  CLASS_ATTENDANCE = 'CLASS_ATTENDANCE',
  /** the screen a class QR opens (/checkin/<slotId>) */
  CHECKIN = 'CHECKIN'
}

export interface AIResponse {
  explanation: string;
}

export interface AttendanceRecord {
  date: string;
  totalInAttendance: number;
  lessonAndDance: number;
  danceOnly: number;
  totalComped: number;
  totalRevenue: number;
  perPersonSplit: number;
}

export interface CompedRecord {
  date: string;
  name: string;
  notes: string;
}

export interface WaiverRecord {
  date: string;
  firstName: string;
  lastName: string;
  email: string;
  newsletterOptIn: boolean;
  acceptedWaiver: boolean;
}
