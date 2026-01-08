
import { AttendanceRecord, CompedRecord } from '../types';

/**
 * 🟡 CONFIGURATION REQUIRED 🟡
 * Paste your Google Apps Script "Web App URL" below.
 * It should look like: https://script.google.com/macros/s/AKfycb.../exec
 */
export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxxTj344yZ1ch1YLWvUdWtNsagsRd8qkp4kGf3jiXWBUmkke0yZCEUer5NnRXOY8zm_/exec';

const isConfigured = () => !GOOGLE_SCRIPT_URL.includes('REPLACE_WITH_YOUR_ID');

const callScript = async (payload: any) => {
  if (!isConfigured()) {
    console.error("SPREADSHEET ERROR: GOOGLE_SCRIPT_URL is not configured in services/spreadsheetService.ts");
    return { error: 'Not configured' };
  }

  try {
    // We use 'no-cors' and 'text/plain' to ensure the request is sent 
    // without triggering a CORS preflight that Google Apps Script doesn't support.
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });
    
    // Because mode is 'no-cors', we can't read the response body,
    // but the request is successfully dispatched to the script.
    return { success: true };
  } catch (error) {
    console.error("Spreadsheet Service Error:", error);
    return { error };
  }
};

export const commitAttendance = async (record: AttendanceRecord): Promise<boolean> => {
  const result = await callScript({ action: 'commitAttendance', ...record });
  return !result.error;
};

export const commitCompedEntry = async (record: CompedRecord): Promise<boolean> => {
  const result = await callScript({ action: 'commitComped', ...record });
  return !result.error;
};

export const fetchCurrentSessionState = async (): Promise<any | null> => {
  if (!isConfigured()) return null;
  
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL);
    if (!response.ok) return null;
    const data = await response.json();
    return data.state;
  } catch (error) {
    return null;
  }
};

export const syncCurrentSessionState = async (state: any): Promise<void> => {
  await callScript({ action: 'syncState', state });
};
