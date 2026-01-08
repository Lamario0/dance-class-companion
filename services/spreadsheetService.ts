
import { AttendanceRecord, CompedRecord } from '../types';

/**
 * IMPORTANT: Replace this URL with your deployed Google Apps Script Web App URL.
 */
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_ID/exec';

const callScript = async (payload: any) => {
  if (GOOGLE_SCRIPT_URL.includes('REPLACE_WITH_YOUR_ID')) {
    console.warn("Spreadsheet connection not configured. Please set GOOGLE_SCRIPT_URL in spreadsheetService.ts");
    return { error: 'Not configured' };
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // Apps Script requires no-cors for simple POST triggers
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    // With no-cors, we can't read the response, but it sends successfully
    return { success: true };
  } catch (error) {
    console.error("Spreadsheet Service Error:", error);
    return { error };
  }
};

export const commitAttendance = async (record: AttendanceRecord): Promise<boolean> => {
  // Writes to "Party Info" tab in Apps Script
  const result = await callScript({ action: 'commitAttendance', ...record });
  return !result.error;
};

export const commitCompedEntry = async (record: CompedRecord): Promise<boolean> => {
  // Writes to "Comped" tab in Apps Script
  const result = await callScript({ action: 'commitComped', ...record });
  return !result.error;
};

export const fetchCurrentSessionState = async (): Promise<any | null> => {
  if (GOOGLE_SCRIPT_URL.includes('REPLACE_WITH_YOUR_ID')) return null;
  
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    const data = await response.json();
    return data.state;
  } catch (error) {
    console.error("Failed to fetch state:", error);
    return null;
  }
};

export const syncCurrentSessionState = async (state: any): Promise<void> => {
  // Writes to "Session State" tab to allow multi-device syncing
  await callScript({ action: 'syncState', state });
};
