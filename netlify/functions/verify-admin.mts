// Server-side admin login. The real admin password lives only in the
// ADMIN_PASSWORD environment variable (Netlify site settings) and never
// reaches the client bundle. A short-lived signed token is handed back so
// the client can remember it's logged in without re-sending the password.
import type { Context } from '@netlify/functions';
import { createHmac, timingSafeEqual } from 'node:crypto';

declare const Netlify: { env: { get(key: string): string | undefined } };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

const safeEqual = (a: string, b: string) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const adminPassword = Netlify.env.get('ADMIN_PASSWORD');
  const sessionSecret = Netlify.env.get('ADMIN_SESSION_SECRET');
  if (!adminPassword || !sessionSecret) {
    console.error('ADMIN_PASSWORD or ADMIN_SESSION_SECRET is not configured.');
    return json({ error: 'Admin login is not configured.' }, 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const submitted = typeof body?.password === 'string' ? body.password : '';
  if (!submitted || !safeEqual(submitted, adminPassword)) {
    // Small constant delay to blunt naive brute-forcing.
    await new Promise((resolve) => setTimeout(resolve, 300));
    return json({ error: 'Incorrect password.' }, 401);
  }

  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  const token = `${payload}.${sign(payload, sessionSecret)}`;

  return json({ token, expiresAt });
};

export const config = {
  path: '/api/admin-login',
};
