import { AppData, DanceClass, VideoItem, SongItem, Announcement } from '../types';
import Papa from 'papaparse';

// We use the standard Spreadsheet ID
const SPREADSHEET_ID = '1VuTfGDldybCC8Lv0FSQG8acMSQ681X93NgUVAXg89Ls';
const SHEET_NAME = 'webapp data';

// Using the export endpoint without 'tq' to get raw data. 
// Note: gviz often skips empty rows, so we cannot rely on fixed row indices (e.g. Row 33 != Index 32).
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
        skipEmptyLines: false,
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

          // Helper: Find row index by header content
          const findRowByHeader = (search: string, startFrom = 0): number => {
            for (let i = startFrom; i < rows.length; i++) {
              const cellA = (rows[i][0] || '').toLowerCase();
              const cellB = (rows[i][1] || '').toLowerCase();
              if (cellA.includes(search.toLowerCase()) || cellB.includes(search.toLowerCase())) {
                return i;
              }
            }
            return -1;
          };

          // --- 1. Classes ---
          // Indices 1-4 (Rows 2-5)
          const classes: DanceClass[] = [];
          for (let i = 1; i <= 4; i++) {
            const name = getCell(i, 0);
            if (name) {
              classes.push({
                id: `class-${i}`,
                name: name,
                content: getCell(i, 1),
                notes: getCell(i, 2)
              });
            }
          }

          const songs: SongItem[] = [];

          // --- 2. New Music ---
          // Indices 7-11 (Rows 8-12)
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

          // --- 3. Blues Music ---
          // Indices 14-18 (Rows 15-19)
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

          // --- 4. Practice Songs ---
          // Indices 21-25 (Rows 22-26)
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
          let vomIndex = findRowByHeader('video of the month', 20);
          
          if (vomIndex === -1) {
             vomIndex = 28; // Fallback index if header not found
          } else {
             vomIndex = vomIndex + 1;
          }

          const rawVomCell = getCell(vomIndex, 0);
          const cleanVomUrl = extractUrl(rawVomCell);
          
          if (cleanVomUrl && (cleanVomUrl.startsWith('http') || /^[a-zA-Z0-9_-]{11}$/.test(cleanVomUrl))) {
            videos.push({
              id: 'vom',
              title: 'Video of the Month',
              url: cleanVomUrl,
              category: 'month'
            });
          }

          // --- 6. Announcements ---
          // Dynamic Search Logic:
          // Because empty rows are stripped, we cannot rely on index 32 being Row 33.
          // We search for a "News" or "Announcements" header, or the "Date/Text" columns.
          
          const announcements: Announcement[] = [];
          let newsStartIndex = -1;

          // Start searching after the songs (approx index 25)
          for (let i = 25; i < rows.length; i++) {
            const cellA = (rows[i][0] || '').toLowerCase().trim();
            const cellB = (rows[i][1] || '').toLowerCase().trim();

            // Check for Section Title
            if (cellA === 'news' || cellA === 'announcements' || cellA.includes('updates')) {
               // Found section title. Data usually starts 1 or 2 rows down.
               // Check if next row is "Date" header
               const nextA = (rows[i+1]?.[0] || '').toLowerCase();
               if (nextA === 'date') {
                 newsStartIndex = i + 2; // Title -> Header -> Data
               } else {
                 newsStartIndex = i + 1; // Title -> Data
               }
               break;
            }

            // Check for Column Headers directly (Date / Text)
            if (cellA === 'date' && (cellB === 'text' || cellB === 'announcement')) {
                newsStartIndex = i + 1; // Header -> Data
                break;
            }
          }

          // If dynamic search failed, try a best-guess based on VOM position + offset
          // But purely relying on the loop below is safer if we just iterate and validate.
          
          if (newsStartIndex !== -1) {
             // We found a start point. Read until we hit empty or end of likely range.
             for (let i = newsStartIndex; i < newsStartIndex + 15 && i < rows.length; i++) {
                const date = getCell(i, 0);
                const text = getCell(i, 1);

                // Stop if we hit a new section (unlikely in this specific sheet structure but good safety)
                if (date.toLowerCase().includes('class')) break;

                if (text) {
                  announcements.push({
                    id: `ann-${i}`,
                    date: date,
                    text: text
                  });
                }
             }
          } else {
             // Fallback: If we couldn't find a header, we scan the last 15 rows of the dataset 
             // assuming News is at the bottom.
             const startScan = Math.max(0, rows.length - 15);
             for (let i = startScan; i < rows.length; i++) {
                 const date = getCell(i, 0);
                 const text = getCell(i, 1);
                 // Heuristic: Valid news item has text and maybe a date
                 if (text && !text.toLowerCase().includes('text') && !date.toLowerCase().includes('date')) {
                      announcements.push({
                        id: `ann-fb-${i}`,
                        date: date,
                        text: text
                      });
                 }
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