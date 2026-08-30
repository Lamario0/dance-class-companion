// Server-side Gemini proxy.
// The Gemini API key must never reach the browser bundle — it's read here
// from the GEMINI_API_KEY environment variable (Netlify site settings),
// which is only available to serverless functions, not the client build.
import type { Context } from '@netlify/functions';

declare const Netlify: { env: { get(key: string): string | undefined } };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const apiKey = Netlify.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured.');
    return json({ error: 'AI Assistant is not configured.' }, 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  try {
    if (body?.action === 'explainPattern') {
      const { patternName, className } = body;
      if (!patternName || !className) {
        return json({ error: 'Missing patternName or className.' }, 400);
      }

      const prompt = `
        You are an expert dance instructor.
        Briefly explain the dance term, pattern, or concept "${patternName}" in the context of "${className}".
        Focus on the key mechanical steps or feeling. Keep it under 50 words.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 0 } },
      });

      return json({ text: response.text ?? '' });
    }

    if (body?.action === 'parseVoiceSearch') {
      const { audioBase64, mimeType } = body;
      if (!audioBase64 || !mimeType) {
        return json({ error: 'Missing audioBase64 or mimeType.' }, 400);
      }

      const prompt =
        'Listen to this audio. The user is searching for a song, artist, or genre in a dance music library. ' +
        'Extract the text search query. Return ONLY the search terms as text. If no search term is detected, return empty string.';

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        contents: {
          parts: [{ inlineData: { mimeType, data: audioBase64 } }, { text: prompt }],
        },
      });

      return json({ text: response.text?.trim() ?? '' });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    console.error('Gemini function error:', error);
    return json({ error: 'AI Assistant is currently unavailable.' }, 502);
  }
};

export const config = {
  path: '/api/ai',
};
