
import { AppData, DanceClass, VideoItem, SongItem, Announcement } from '../types';
import Papa from 'papaparse';

const SPREADSHEET_ID = '1VuTfGDldybCC8Lv0FSQG8acMSQ681X93NgUVAXg89Ls';
const SHEET_NAME = 'webapp data';

// Range covering most used areas to ensure performance
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}&range=A1:G150&headers=0&t=${Date.now()}`;

const DEFAULT_DATA: AppData = {
  classes: [],
  videos: [],
  songs: [],
  announcements: []
};

export const fetchSheetData = async (): Promise<AppData> => {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    const csvText = await response.text();

    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, 
        skipEmptyLines: false,
        complete: (results) => {
          const rows = results.data as string[][];
          
          const getCell = (r: number, c: number) => {
            if (!rows[r]) return '';
            return rows[r][c] ? String(rows[r][c]).trim() : '';
          };
          
          const extractUrl = (text: string): string => {
            if (!text) return '';
            // Match any URL-like string or just a YouTube ID (11 chars)
            const match = text.match(/https?:\/\/[^\s"']+/i);
            if (match) return match[0].replace(/[,.)\]}]+$/, '');
            if (/^[a-zA-Z0-9_-]{11}$/.test(text.trim())) return text.trim();
            return '';
          };

          // 1. Classes: STRICTLY Rows 2-5 (Indices 1-4)
          const classes: DanceClass[] = [];
          for (let i = 1; i <= 4; i++) {
            const name = getCell(i, 0);
            const content = getCell(i, 1);
            const notes = getCell(i, 2);
            
            // Stricter Header/Empty Detection
            const lowerName = name.toLowerCase();
            const isHeader = 
              lowerName === 'title' || 
              lowerName === 'name' || 
              lowerName === 'class' || 
              lowerName === 'artist' ||
              lowerName === 'youtube link' ||
              lowerName.includes('link');
            
            const isEmpty = !name || name === '-' || name === '.';
            
            if (!isEmpty && !isHeader && !name.startsWith('http')) {
              classes.push({
                id: `class-${i}`,
                name: name,
                content: content || 'Patterns TBD',
                notes: notes || 'No notes for this week.'
              });
            }
          }

          // 2. Music Sections
          const songs: SongItem[] = [];
          const parseMusic = (start: number, end: number, cat: 'new' | 'blues' | 'practice') => {
            for (let i = start; i <= end; i++) {
              const title = getCell(i, 0);
              const artist = getCell(i, 1);
              const url = extractUrl(getCell(i, 2));
              
              const lowerTitle = title.toLowerCase();
              const isHeader = lowerTitle === 'title' || lowerTitle.includes('music') || lowerTitle === 'song';
              
              if (title && !isHeader) {
                songs.push({
                  id: `${cat}-${i}`,
                  title,
                  artist: artist,
                  url: url,
                  category: cat
                });
              }
            }
          };
          parseMusic(7, 11, 'new');    
          parseMusic(14, 18, 'blues'); 
          parseMusic(21, 25, 'practice'); 

          const videos: VideoItem[] = [];

          // 3. Video of the Month: Target Row 29 (Index 28)
          // Search across all columns in Row 29 to be safe
          let vomUrlFound = '';
          for (let col = 0; col < 7; col++) {
            const val = getCell(28, col);
            const potential = extractUrl(val);
            if (potential) {
              vomUrlFound = potential;
              break;
            }
          }

          if (vomUrlFound) {
            videos.push({ 
              id: 'vom', 
              title: 'Featured Pattern',
              url: vomUrlFound, 
              category: 'month' 
            });
          }

          // 4. Tutorials: Column F (Title) and G (URL)
          const playlistUrl = extractUrl(getCell(0, 5));
          if (playlistUrl) {
            videos.push({ id: 'tut-playlist', title: 'Master Tutorials Playlist', url: playlistUrl, category: 'tutorial' });
          }

          for (let i = 1; i < 100; i++) {
            // Skip the VOM row to avoid tutorial duplicates
            if (i === 28) continue;
            
            const title = getCell(i, 5); 
            const url = extractUrl(getCell(i, 6)); 
            if (title && url && url !== playlistUrl) {
              videos.push({ id: `tut-list-${i}`, title, url, category: 'tutorial' });
            }
          }

          // 5. Announcements
          const announcements: Announcement[] = [];
          let newsStart = -1;
          for (let i = 30; i < rows.length; i++) {
            const cellA = getCell(i, 0).toLowerCase();
            if (cellA === 'news' || cellA === 'announcements' || cellA === 'updates') {
              newsStart = i + 1;
              break;
            }
          }
          const finalNewsStart = newsStart !== -1 ? newsStart : 35;
          for (let i = finalNewsStart; i < finalNewsStart + 15 && i < rows.length; i++) {
            const date = getCell(i, 0);
            const text = getCell(i, 1);
            if (text && text.toLowerCase() !== 'text' && text.toLowerCase() !== 'announcement') {
              announcements.push({ id: `ann-${i}`, date, text });
            }
          }

          resolve({ classes, videos, songs, announcements });
        },
        error: (err) => resolve(DEFAULT_DATA)
      });
    });
  } catch (error) {
    return DEFAULT_DATA;
  }
};
