
// Client-side wrapper for the Gemini features. All calls go through the
// /api/ai Netlify function (netlify/functions/gemini.mts) — the Gemini API
// key stays server-side and is never bundled into the client.

const callAi = async (payload: Record<string, unknown>): Promise<string> => {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  return typeof data.text === 'string' ? data.text : '';
};

/**
 * Explains a dance pattern or term using Gemini.
 * @param patternName The name of the dance pattern or term.
 * @param className The context (e.g., "West Coast Swing").
 */
export const explainPattern = async (patternName: string, className: string): Promise<string> => {
  try {
    const text = await callAi({ action: 'explainPattern', patternName, className });
    return text || "Could not generate an explanation at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI Assistant is currently unavailable. Please try again later.";
  }
};

/**
 * Extracts search keywords from an audio recording of a user voice query.
 * @param audioBase64 Base64 encoded audio string (raw data from recorder).
 * @param mimeType The mime type of the audio (e.g., 'audio/webm' or 'audio/mp4').
 */
export const parseVoiceSearch = async (audioBase64: string, mimeType: string): Promise<string> => {
  try {
    const text = await callAi({ action: 'parseVoiceSearch', audioBase64, mimeType });
    return text.trim();
  } catch (error) {
    console.error("Gemini Voice Search Error:", error);
    return "";
  }
};
