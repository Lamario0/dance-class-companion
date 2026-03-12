
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
      model: 'gemini-3-flash-preview',
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

