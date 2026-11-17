// CORS for the Capacitor app only (spec slice 5). The website calls the API
// same-origin and needs no CORS; the Android app's WebView runs at
// https://localhost (capacitor://localhost on iOS) and calls the live site.
// Any other origin gets no CORS headers, so browsers block it.

const APP_ORIGINS = new Set(['https://localhost', 'capacitor://localhost']);

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '600',
  Vary: 'Origin',
});

type Handler = (req: Request, context?: unknown) => Promise<Response>;

/** Wrap a function handler: answer preflight and add CORS headers for the app's origin. */
export const withAppCors = (handler: Handler): Handler => async (req, context) => {
  const origin = req.headers.get('origin') || '';
  const allowed = APP_ORIGINS.has(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: allowed ? 204 : 403, headers: allowed ? corsHeaders(origin) : {} });
  }

  const res = await handler(req, context);
  if (!allowed) return res;
  const headers = new Headers(res.headers);
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => headers.set(k, v));
  return new Response(res.body, { status: res.status, headers });
};
