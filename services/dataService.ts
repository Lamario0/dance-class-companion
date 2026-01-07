
import { AppData, DanceClass, VideoItem, SongItem, Announcement } from '../types';
import Papa from 'papaparse';

// We use the standard Spreadsheet ID
const SPREADSHEET_ID = '1VuTfGDldybCC8Lv0FSQG8acMSQ681X93NgUVAXg89Ls';
const SHEET_NAME = 'webapp data';

/**
 * The gviz endpoint is reliable for fetching ranges. 
 */
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}&range=A1:E100&headers=0&t=${Date.now()}`;

// Default data used as fallback if fetch fails
const DEFAULT_DATA: AppData = {
  classes: [],
  videos: [],
  songs: [],
  announcements: []
};

/**
 * Fetches data from the specific Google Sheet layout.
 */
export const fetchSheetData = async (): Promise<AppData> => {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    }

    const csvText = await response.text();

    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false, 
        skipEmptyLines: false, // Keep empty lines to maintain strict row index alignment
        complete: (results) => {
          const rows = results.data as string[][];
          
          // Helper to safely get a cell value. 
          const getCell = (r: number, c: number) => {
            return rows[r] && rows[r][c] ? rows[r][c].trim() : '';
          };

          // Helper: Extract first URL from text if present
          const extractUrl = (text: string): string => {
            const match = text.match(/https?:\/\/[^\s"']+/);
            if (match) {
              return match[0].replace(/[,.)\]}]+$/, '');
            }
            return text;
          };

          // --- 1. Classes (STRICTLY Rows 2-5 / Indices 1-4) ---
          const classes: DanceClass[] = [];
          for (let i = 1; i <= 4; i++) {
            const name = getCell(i, 0); // Column A
            const content = getCell(i, 1); // Column B
            const notes = getCell(i, 2); // Column C

            // Safeguards to detect if music data has "slid up" into the class indices (1-4)
            const lowerName = name.toLowerCase();
            const lowerNotes = notes.toLowerCase();
            
            const isMusicHeader = lowerName.includes('music') || lowerName.includes('song') || lowerName.includes('playlist');
            const isMusicUrl = lowerNotes.startsWith('http') || lowerNotes.includes('spotify') || lowerNotes.includes('youtube');
            const isEmpty = !name || lowerName === 'class name' || lowerName === 'name' || name === '-';

            // Only add the class if it's not empty and definitely not music data
            if (!isEmpty && !isMusicHeader && !isMusicUrl) {
              classes.push({
                id: `class-${i}`,
                name: name,
                content: content,
                notes: notes
              });
            }
          }

          const songs: SongItem[] = [];

          // --- 2. New Music (Rows 8-12 / Indices 7-11) ---
          for (let i = 7; i <= 11; i++) {
            const title = getCell(i, 0);
            if (title && !title.toLowerCase().includes('music')) { 
              songs.push({
                id: `new-${i}`,
                title: title,
                artist: getCell(i, 1),
                url: extractUrl(getCell(i, 2)),
                category: 'new'
              });
            }
          }

          // --- 3. Blues Music (Rows 15-19 / Indices 14-18) ---
          for (let i = 14; i <= 18; i++) {
            const title = getCell(i, 0);
            if (title && !title.toLowerCase().includes('music')) {
              songs.push({
                id: `blues-${i}`,
                title: title,
                artist: getCell(i, 1),
                url: extractUrl(getCell(i, 2)),
                category: 'blues'
              });
            }
          }

          // --- 4. Practice Songs (Rows 22-26 / Indices 21-25) ---
          for (let i = 21; i <= 25; i++) {
            const title = getCell(i, 0);
            if (title && !title.toLowerCase().includes('songs')) {
              songs.push({
                id: `practice-${i}`,
                title: title,
                artist: getCell(i, 1),
                url: extractUrl(getCell(i, 2)),
                category: 'practice'
              });
            }
          }

          const videos: VideoItem[] = [];

          // --- 5. Video of the Month ---
          let vomIndex = -1;
          for (let i = 25; i < 45; i++) {
            if (getCell(i, 0).toLowerCase().includes('video of the month')) {
              vomIndex = i + 1; 
              break;
            }
          }
          
          if (vomIndex !== -1 && vomIndex < rows.length) {
            const cleanVomUrl = extractUrl(getCell(vomIndex, 0));
            if (cleanVomUrl) {
              videos.push({
                id: 'vom',
                title: 'Video of the Month',
                url: cleanVomUrl,
                category: 'month'
              });
            }
          }

          // --- 6. Announcements ---
          const announcements: Announcement[] = [];
          
          let newsStart = -1;
          for (let i = 25; i < rows.length; i++) {
            const cellA = getCell(i, 0).toLowerCase();
            if (cellA === 'news' || cellA === 'announcements' || (cellA === 'date' && getCell(i, 1).toLowerCase().includes('text'))) {
              newsStart = (cellA === 'date') ? i + 1 : i + 2;
              break;
            }
          }

          const finalNewsStart = newsStart !== -1 ? newsStart : 32;

          for (let i = finalNewsStart; i < finalNewsStart + 11 && i < rows.length; i++) {
            const date = getCell(i, 0);
            const text = getCell(i, 1);
            if (text && text.toLowerCase() !== 'text') {
              announcements.push({
                id: `ann-${i}`,
                date: date,
                text: text
              });
            }
          }

          resolve({ classes, videos, songs, announcements });
        },
        error: (err) => {
          console.error("CSV Parse Error:", err);
          resolve(DEFAULT_DATA);
        }
      });
    });

  } catch (error) {
    console.error("Data Service Error:", error);
    return DEFAULT_DATA;
  }
};
