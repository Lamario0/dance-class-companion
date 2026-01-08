
import { AppData, DanceClass, VideoItem, SongItem, Announcement } from '../types';
import Papa from 'papaparse';

const SPREADSHEET_ID = '1VuTfGDldybCC8Lv0FSQG8acMSQ681X93NgUVAXg89Ls';
const SHEET_NAME = 'webapp data';

// Range A1:G150 captures Column F (Titles) and Column G (URLs)
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
          const getCell = (r: number, c: number) => rows[r] && rows[r][c] ? rows[r][c].trim() : '';
          
          const extractUrl = (text: string): string => {
            if (!text) return '';
            const match = text.match(/https?:\/\/[^\s"']+/);
            return match ? match[0].replace(/[,.)\]}]+$/, '') : (text.startsWith('http') ? text : '');
          };

          // --- 1. Classes (Rows 2-5) ---
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

          // --- 2. Music Sections ---
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
          parseMusic(7, 11, 'new');
          parseMusic(14, 18, 'blues');
          parseMusic(21, 25, 'practice');

          const videos: VideoItem[] = [];

          // --- 3. Video of the Month (Strictly Row 29 / Index 28) ---
          let vomUrl = extractUrl(getCell(28, 0)); 
          if (!vomUrl) {
            for (let i = 25; i < 40; i++) {
              const label = getCell(i, 0).toLowerCase();
              if (label.includes('video of the month')) {
                vomUrl = extractUrl(getCell(i, 0)) || extractUrl(getCell(i + 1, 0));
                break;
              }
            }
          }
          if (vomUrl) {
            videos.push({ id: 'vom', title: 'Video of the Month', url: vomUrl, category: 'month' });
          }

          // --- 4. Tutorials (Column F for Titles, Column G for URLs) ---
          // A. Playlist from F1 (Index 0, 5) 
          const playlistUrl = extractUrl(getCell(0, 5));
          if (playlistUrl) {
            videos.push({ id: 'tut-playlist', title: 'Master Tutorials Playlist', url: playlistUrl, category: 'tutorial' });
          }

          // B. Individual Tutorials starting at Row 2 (Index 1)
          // F = Index 5 (Title), G = Index 6 (URL)
          for (let i = 1; i < 100; i++) {
            const title = getCell(i, 5); 
            const url = extractUrl(getCell(i, 6)); 
            
            if (title && url) {
              if (url !== playlistUrl) {
                videos.push({ id: `tut-list-${i}`, title, url, category: 'tutorial' });
              }
            } else if (i > 10 && !title && !url) {
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
