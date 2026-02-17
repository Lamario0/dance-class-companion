
import { AppData, DanceClass, VideoItem, SongItem, Announcement } from '../types';

const SPREADSHEET_ID = '1VuTfGDldybCC8Lv0FSQG8acMSQ681X93NgUVAXg89Ls';
const SHEET_NAME = 'webapp data';

// We use `tq=select *` to force the API to return the full grid starting from A1.
// Note: The API may still compress empty rows, so we rely on content headers (Anchors) 
// instead of fixed row numbers.
const DATA_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}&headers=0&tq=select%20*&t=${Date.now()}`;

const DEFAULT_DATA: AppData = {
  classes: [],
  videos: [],
  songs: [],
  announcements: []
};

export const fetchSheetData = async (): Promise<AppData> => {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    const text = await response.text();

    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
    if (!jsonMatch) throw new Error("Could not parse Google Sheet response");

    const data = JSON.parse(jsonMatch[1]);
    const rows = data.table.rows;

    // Helper to safely access cell data
    const getCell = (rowIndex: number, colIndex: number): string => {
      if (!rows[rowIndex]) return '';
      const cell = rows[rowIndex].c[colIndex];
      return cell && cell.v ? String(cell.v).trim() : '';
    };

    const extractUrl = (text: string): string => {
      if (!text) return '';
      const match = text.match(/https?:\/\/[^\s"']+/i);
      if (match) return match[0].replace(/[,.)\]}]+$/, '');
      if (/^[a-zA-Z0-9_-]{11}$/.test(text.trim())) return text.trim();
      return '';
    };

    // --- CONTENT-AWARE ANCHOR SYSTEM ---
    // 1. Scan the sheet to find the exact indices of the "Title / Artist" headers.
    //    These headers define the start of the 3 Music blocks.
    const headerIndices: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const colA = getCell(i, 0).toLowerCase();
      const colB = getCell(i, 1).toLowerCase();
      
      // We look for the literal headers "Title" and "Artist"
      if (colA === 'title' && colB === 'artist') {
        headerIndices.push(i);
      }
    }

    // --- 1. CLASSES ---
    // Rule: Classes occupy Row 2, 3, 4, 5 (Indices 1-4).
    // CRITICAL: We must stop BEFORE the first Music Header.
    const classes: DanceClass[] = [];
    const firstHeaderIndex = headerIndices.length > 0 ? headerIndices[0] : 999;
    
    // We strictly look at indices 1, 2, 3, 4.
    for (let i = 1; i <= 4; i++) {
      // If we've hit the music section (or end of data), STOP.
      if (i >= firstHeaderIndex) break;
      if (i >= rows.length) break;

      const name = getCell(i, 0); // Col A
      const content = getCell(i, 1); // Col B
      const notes = getCell(i, 2); // Col C

      // Only add if it looks like a valid class (has a name and isn't a placeholder)
      if (name && name !== '-' && name !== '.') {
        classes.push({
          id: `class-${i}`,
          name: name,
          content: content || 'Patterns TBD',
          notes: notes || 'No notes for this week.'
        });
      }
    }

    // --- 2. MUSIC CARDS ---
    // We map the 3 found headers to our 3 categories: New, Blues, Practice.
    // Data is strictly in the 5 rows FOLLOWING each header.
    const songs: SongItem[] = [];
    const categories = ['new', 'blues', 'practice'] as const;

    categories.forEach((category, idx) => {
      // Check if this category's header exists
      if (idx < headerIndices.length) {
        const headerRow = headerIndices[idx];
        const startRow = headerRow + 1;
        const endRow = startRow + 5; // Look at exactly 5 rows after header

        for (let i = startRow; i < endRow; i++) {
          if (i >= rows.length) break;
          
          // Safety: Don't read into the NEXT header if they are close together
          if (headerIndices.includes(i)) break;

          const title = getCell(i, 0);
          const artist = getCell(i, 1);
          const url = extractUrl(getCell(i, 2));

          if (title && title !== '-' && title !== '.') {
            songs.push({ id: `${category}-${i}`, title, artist, url, category });
          }
        }
      }
    });

    // --- 3. VIDEO OF THE MONTH ---
    // Logic: Locate the "Video of the Month" header explicitly in Column A.
    // The data is in the row immediately following the header.
    
    const videos: VideoItem[] = [];
    let vomDataRowIndex = -1;

    // Scan specifically for the header to avoid issues with skipped spacer rows
    for (let i = 0; i < rows.length; i++) {
      const cellValue = getCell(i, 0).toLowerCase();
      if (cellValue.includes('video of the month')) {
        vomDataRowIndex = i + 1; // Data is expected in the immediate next row
        break;
      }
    }
    
    // Strict extraction: Only check this specific row for the VOM
    if (vomDataRowIndex !== -1 && vomDataRowIndex < rows.length) {
       const cellValue = getCell(vomDataRowIndex, 0);
       const url = extractUrl(cellValue);
       
       if (url) {
         videos.push({
           id: 'vom',
           title: 'Featured Pattern',
           url: url,
           category: 'month'
         });
       }
    }

    // --- 4. TUTORIALS ---
    // These are in Col F & G. They are independent of the main A/B/C structure.
    for (let i = 0; i < rows.length; i++) {
      const title = getCell(i, 5); // Col F
      const url = extractUrl(getCell(i, 6)); // Col G
      
      if (title && url) {
        const category = 'tutorial';
        const id = url.includes('list=') ? 'tut-playlist' : `tut-${i}`;
        videos.push({ id, title, url, category });
      }
    }

    // --- 5. ANNOUNCEMENTS ---
    // User Specification:
    // - Columns A & B.
    // - Two header rows (e.g. Row 31 "Announcements", Row 32 "Date/Details").
    // - Data starts after these two rows.
    // - Use content-aware anchor.
    
    const announcements: Announcement[] = [];
    let annAnchorIndex = -1;

    // Scan for the "Announcements" anchor in Column A
    for (let i = 0; i < rows.length; i++) {
      const val = getCell(i, 0).toLowerCase();
      if (val.includes('announcements')) {
        annAnchorIndex = i;
        break;
      }
    }

    if (annAnchorIndex !== -1) {
      // We assume two header rows: 
      // 1. The Anchor Row found (e.g., 31)
      // 2. The sub-header row (e.g., 32)
      // Data starts at Anchor + 2
      const startDataIndex = annAnchorIndex + 2;

      for (let i = startDataIndex; i < rows.length; i++) {
        const date = getCell(i, 0); // Col A
        const text = getCell(i, 1); // Col B
        const details = getCell(i, 2); // Col C
        const color = getCell(i, 3); // Col D
        
        // Stop if we hit emptiness or structural breaks. 
        // We require 'text' for it to be a valid announcement.
        if (text && text !== '-') {
           announcements.push({
             id: `ann-${i}`,
             date: date,
             text: text,
             details: details,
             color: color
           });
        }
      }
    }

    return { classes, videos, songs, announcements };

  } catch (error) {
    console.error("Fetch Data Error:", error);
    return DEFAULT_DATA;
  }
};
