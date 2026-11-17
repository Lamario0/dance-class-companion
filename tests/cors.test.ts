// CORS for the Capacitor app only (spec slice 5, criteria 4-5).
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'dance-class-companion';
process.env.DCC_USE_EMULATORS = '1';

const handlers = {
  users: (await import('../netlify/functions/admin-users.mts')).default,
  role: (await import('../netlify/functions/admin-role.mts')).default,
  del: (await import('../netlify/functions/delete-account.mts')).default,
  login: (await import('../netlify/functions/verify-admin.mts')).default,
};

const req = (method: string, origin?: string) =>
  new Request('https://danceclasscompanion.com/api/x', {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(method === 'OPTIONS' ? { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' } : {}),
    },
  });

for (const [name, h] of Object.entries(handlers)) {
  test(`${name}: preflight allowed for the Android app origin`, async () => {
    const res = await h(req('OPTIONS', 'https://localhost'));
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://localhost');
    assert.match(res.headers.get('access-control-allow-headers') || '', /Authorization/);
  });

  test(`${name}: other websites get no CORS (browser blocks them)`, async () => {
    const pre = await h(req('OPTIONS', 'https://evil.example'));
    assert.equal(pre.status, 403);
    assert.equal(pre.headers.get('access-control-allow-origin'), null);
    const res = await h(req(name === 'users' ? 'GET' : 'POST', 'https://evil.example'));
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });
}

test('app-origin responses carry CORS headers even on errors (so the app can read the message)', async () => {
  const res = await handlers.users(req('GET', 'https://localhost'));
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://localhost');
  assert.match(await res.text(), /sign in/i);
});

test('same-origin website calls are unchanged (no CORS headers needed)', async () => {
  const res = await handlers.users(req('GET'));
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});
