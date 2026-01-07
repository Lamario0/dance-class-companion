import { GoogleGenAI } from "@google/genai";

// Initialize the client strictly using process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Explains a dance pattern or term using Gemini.
 * @param patternName The name of the dance pattern or term.
 * @param className The context (e.g., "West Coast Swing").
 */
export const explainPattern = async (patternName: string, className: string): Promise<string> => {
  try {
    const prompt = `
      You are an expert dance instructor. 
      Briefly explain the dance term, pattern, or concept "${patternName}" in the context of "${className}".
      Focus on the key mechanical steps or feeling. Keep it under 50 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Low latency preferred for UI tooltips
      }
    });

    if (response.text) {
        return response.text;
    }
    return "Could not generate an explanation at this time.";

  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI Assistant is currently unavailable. Please check your API key.";
  }
};

/**
 * Extracts search keywords from an audio recording of a user voice query.
 * @param audioBase64 Base64 encoded audio string (raw data from recorder).
 * @param mimeType The mime type of the audio (e.g., 'audio/webm' or 'audio/mp4').
 */
export const parseVoiceSearch = async (audioBase64: string, mimeType: string): Promise<string> => {
  try {
    const prompt = "Listen to this audio. The user is searching for a song, artist, or genre in a dance music library. Extract the text search query. Return ONLY the search terms as text. If no search term is detected, return empty string.";

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64
            }
          },
          { text: prompt }
        ]
      }
    });

    return response.text?.trim() || "";
  } catch (error) {
    console.error("Gemini Voice Search Error:", error);
    return "";
  }
};