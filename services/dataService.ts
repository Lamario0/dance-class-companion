
import { AppData, DanceClass, VideoItem, SongItem, Announcement } from '../types';
import Papa from 'papaparse';

const SPREADSHEET_ID = '1VuTfGDldybCC8Lv0FSQG8acMSQ681X93NgUVAXg89Ls';
const SHEET_NAME = 'webapp data';

// Range A1:G150 covers Column F (Titles) and Column G (URLs)
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
            // Match any URL-like string
            const match = text.match(/https?:\/\/[^\s"']+/i);
            if (match) {
              return match[0].replace(/[,.)\]}]+$/, '');
            }
            // Fallback for just raw YouTube IDs if provided
            if (/^[a-zA-Z0-9_-]{11}$/.test(text.trim())) {
              return text.trim();
            }
            return '';
          };

          // --- 1. Classes (Rows 2-5 / Indices 1-4) ---
          const classes: DanceClass[] = [];
          for (let i = 1; i <= 4; i++) {
            const name = getCell(i, 0);
            if (name && name !== '-' && !name.toLowerCase().includes('name')) {
              classes.push({
                id: `class-${i}`,
                name,
                content: getCell(i, 1),
                notes: getCell(i, 2)
              });
            }
          }

          // --- 2. Music Sections (Fixed Ranges) ---
          const songs: SongItem[] = [];
          const parseMusic = (start: number, end: number, cat: 'new' | 'blues' | 'practice') => {
            for (let i = start; i <= end; i++) {
              const title = getCell(i, 0);
              if (title && !title.toLowerCase().includes('music') && !title.toLowerCase().includes('songs')) {
                songs.push({
                  id: `${cat}-${i}`,
                  title,
                  artist: getCell(i, 1),
                  url: extractUrl(getCell(i, 2)),
                  category: cat
                });
              }
            }
          };
          parseMusic(7, 11, 'new');    // Rows 8-12
          parseMusic(14, 18, 'blues'); // Rows 15-19
          parseMusic(21, 25, 'practice'); // Rows 22-26

          const videos: VideoItem[] = [];

          // --- 3. Video of the Month (Strictly Row 29 / Column A) ---
          // Index 28 is Row 29. Column A is Index 0.
          const vomRaw = getCell(28, 0);
          const vomUrl = extractUrl(vomRaw);
          if (vomUrl) {
            videos.push({ id: 'vom', title: 'Video of the Month', url: vomUrl, category: 'month' });
          }

          // --- 4. Tutorials (Column F for Titles, Column G for URLs) ---
          // A. Playlist from F1 (Index 0, Column Index 5)
          const playlistUrl = extractUrl(getCell(0, 5));
          if (playlistUrl) {
            videos.push({ id: 'tut-playlist', title: 'Master Tutorials Playlist', url: playlistUrl, category: 'tutorial' });
          }

          // B. Individual Tutorials starting at Row 2 (Index 1)
          // Column F = Index 5 (Title), Column G = Index 6 (URL)
          for (let i = 1; i < 100; i++) {
            const title = getCell(i, 5); 
            const url = extractUrl(getCell(i, 6)); 
            
            if (title && url) {
              if (url !== playlistUrl) {
                videos.push({ id: `tut-list-${i}`, title, url, category: 'tutorial' });
              }
            } else if (i > 5 && !title && !url) {
              // Stop if we find an empty row after the initial possible header
              break; 
            }
          }

          // --- 5. Announcements ---
          const announcements: Announcement[] = [];
          let newsStart = -1;
          for (let i = 30; i < rows.length; i++) {
            const cellA = getCell(i, 0).toLowerCase();
            if (cellA === 'news' || cellA === 'announcements') {
              newsStart = i + 1;
              break;
            }
          }
          const finalNewsStart = newsStart !== -1 ? newsStart : 35;
          for (let i = finalNewsStart; i < finalNewsStart + 15 && i < rows.length; i++) {
            const date = getCell(i, 0);
            const text = getCell(i, 1);
            if (text && text.toLowerCase() !== 'text') {
              announcements.push({ id: `ann-${i}`, date, text });
            }
          }

          resolve({ classes, videos, songs, announcements });
        },
        error: (err) => {
          console.error("PapaParse error:", err);
          resolve(DEFAULT_DATA);
        }
      });
    });
  } catch (error) {
    console.error("Data Service Fetch error:", error);
    return DEFAULT_DATA;
  }
};
