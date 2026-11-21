// Slice 6 functions against the emulators, FCM send stubbed (criteria 1, 2, 3, 5, 11).
// Needs: npm run emulators
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'dance-class-companion';
process.env.DCC_USE_EMULATORS = '1';

const { adminAuth, adminDb } = await import('../netlify/lib/firebaseAdmin.mts');
const { setSenderForTests, tokenId } = await import('../netlify/lib/push.mts');
const { default: register } = await import('../netlify/functions/push-register.mts');
const { default: chatNotify } = await import('../netlify/functions/chat-notify.mts');
const { default: adminNotify } = await import('../netlify/functions/admin-notify.mts');
const { default: mine } = await import('../netlify/functions/notifications-mine.mts');
const { Timestamp, FieldValue } = await import('firebase-admin/firestore');

const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const stamp = Date.now();
const PASSWORD = 'notify-test-pass';

type Sent = { platform: 'android' | 'web'; tokens: string[]; msg: any };
let sent: Sent[] = [];
let dead = new Set<string>();
setSenderForTests(async (msg, tokens) => {
  sent.push({ platform: (msg as any).android ? 'android' : 'web', tokens, msg });
  return tokens.map(t => (dead.has(t) ? { ok: false, code: 'messaging/registration-token-not-registered' } : { ok: true }));
});
const tokensSent = () => sent.flatMap(s => s.tokens).sort();

const makeAccount = async (tag: string, admin = false) => {
  const email = `${tag}-${stamp}@test.dev`;
  const u = await adminAuth().createUser({ email, password: PASSWORD, emailVerified: true });
  if (admin) await adminAuth().setCustomUserClaims(u.uid, { admin: true });
  await adminDb().doc(`users/${u.uid}`).set({ displayName: `${tag} name`, createdAt: new Date() });
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  return { uid: u.uid, token: (await res.json()).idToken as string };
};
const call = async (fn: (r: Request) => Promise<Response>, body: unknown, token?: string) => {
  const res = await fn(new Request('http://localhost/api/x', { method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};
const tok = (name: string) => `${name}-${stamp}-${'x'.repeat(24)}`;

let boss: { uid: string; token: string };
let ann: { uid: string; token: string };
let ben: { uid: string; token: string };
let cat: { uid: string; token: string };

before(async () => {
  // Earlier runs' devices would receive these sends too.
  const old = await adminDb().collection('pushTokens').get();
  await Promise.all(old.docs.map(d => d.ref.delete()));
  boss = await makeAccount('nboss', true);
  ann = await makeAccount('nann');
  ben = await makeAccount('nben');
  cat = await makeAccount('ncat');
  // ann: phone + web; ben: phone; cat: web; boss: phone; plus a signed-out phone and a signed-out browser.
  const devices: Array<[string, string, { token: string } | null]> = [
    ['ann-phone', 'android', ann], ['ann-web', 'web', ann], ['ben-phone', 'android', ben], ['cat-web', 'web', cat],
    ['boss-phone', 'android', boss], ['anon-phone', 'android', null], ['anon-web', 'web', null],
  ];
  for (const [t, p, who] of devices) {
    assert.equal((await call(register, { token: tok(t), platform: p }, who?.token)).status, 200);
  }
  await adminDb().doc(`levels/${ben.uid}`).set({ dances: { WCS: { level: '200' } } });
});
beforeEach(() => { sent = []; dead = new Set(); });

const post = async (over: Record<string, unknown>) => {
  const ref = adminDb().collection('chatMessages').doc();
  await ref.set({ author: 'Someone', text: 'Hello floor', parentId: null, quarter: '2026-Q4', createdAt: FieldValue.serverTimestamp(), ...over });
  return ref.id;
};

test('registering: bad input refused; the uid comes from the sign-in, not the body', async () => {
  assert.equal((await call(register, { token: 'short', platform: 'android' })).status, 400);
  assert.equal((await call(register, { token: tok('z'), platform: 'ios' })).status, 400);
  await call(register, { token: tok('spoof'), platform: 'web', uid: ann.uid });
  assert.equal((await adminDb().doc(`pushTokens/${tokenId(tok('spoof'))}`).get()).data()!.uid, null);
  await adminDb().doc(`pushTokens/${tokenId(tok('spoof'))}`).delete();
});

test("criterion 1: a member's post reaches every other account's devices, not the poster's or signed-out ones", async () => {
  const id = await post({ author: 'nann name', uid: ann.uid, role: 'member' });
  const r = await call(chatNotify, { id });
  assert.equal(r.status, 200);
  assert.deepEqual(tokensSent(), [tok('ben-phone'), tok('boss-phone'), tok('cat-web')].sort());
  const android = sent.find(s => s.platform === 'android')!;
  assert.equal(android.msg.notification.title, 'nann name in chat');
  assert.equal(android.msg.android.notification.tag, 'chat');
  const web = sent.find(s => s.platform === 'web')!;
  assert.equal(web.msg.notification, undefined); // the service worker shows it
  assert.equal(web.msg.data.tab, 'news');
});

test('criterion 2: once per message; missing, deleted or old messages refused; guest posts notify', async () => {
  const id = await post({ author: 'Walk-in Wendy' });
  assert.equal((await call(chatNotify, { id })).body.status, 'sent');
  assert.equal(tokensSent().length, 5); // every signed-in device (ann has two)
  sent = [];
  assert.equal((await call(chatNotify, { id })).body.status, 'already');
  assert.equal(sent.length, 0);
  assert.equal((await call(chatNotify, { id: 'nope' })).status, 404);
  assert.equal((await call(chatNotify, { id: await post({ deleted: true }) })).status, 404);
  const old = await post({ createdAt: Timestamp.fromMillis(Date.now() - 3 * 60 * 1000) });
  assert.equal((await call(chatNotify, { id: old })).status, 409);
  assert.equal(sent.length, 0);
});

test('criterion 5: an account with chat notifications off gets none; back on, it does', async () => {
  await adminDb().doc(`users/${cat.uid}`).update({ chatNotify: false });
  await call(chatNotify, { id: await post({ author: 'Guest' }) });
  assert.ok(!tokensSent().includes(tok('cat-web')));
  sent = [];
  await adminDb().doc(`users/${cat.uid}`).update({ chatNotify: true });
  await call(chatNotify, { id: await post({ author: 'Guest' }) });
  assert.ok(tokensSent().includes(tok('cat-web')));
});

test('criterion 11: muting a member or a guest stops their notifications; muting an admin does nothing', async () => {
  await adminDb().doc(`users/${ben.uid}`).update({ muted: [{ k: `u:${ann.uid}`, n: 'nann name' }, { k: 'g:walk-in wendy', n: 'Walk-in Wendy' }, { k: `u:${boss.uid}`, n: 'Boss' }] });
  await call(chatNotify, { id: await post({ author: 'nann name', uid: ann.uid, role: 'member' }) });
  assert.ok(!tokensSent().includes(tok('ben-phone')));
  sent = [];
  await call(chatNotify, { id: await post({ author: '  WALK-IN Wendy ' }) });
  assert.ok(!tokensSent().includes(tok('ben-phone')));
  sent = [];
  await call(chatNotify, { id: await post({ author: 'Walk-in Wendy 2' }) }); // another name: not muted
  assert.ok(tokensSent().includes(tok('ben-phone')));
  sent = [];
  await call(chatNotify, { id: await post({ author: 'nboss name', uid: boss.uid, role: 'admin' }) });
  assert.ok(tokensSent().includes(tok('ben-phone')));
  // A non-admin can't escape a mute by claiming the admin role on the message.
  sent = [];
  await call(chatNotify, { id: await post({ author: 'nann name', uid: ann.uid, role: 'admin' }) });
  assert.ok(!tokensSent().includes(tok('ben-phone')));
  await adminDb().doc(`users/${ben.uid}`).update({ muted: [] });
});

test('criterion 3: admin sends reach app devices only; groups only signed-in app users at that level; students refused', async () => {
  assert.equal((await call(adminNotify, { action: 'count', audience: { kind: 'all' } }, ann.token)).status, 403);
  assert.equal((await call(adminNotify, { action: 'count', audience: { kind: 'all' } }, boss.token)).body.devices, 4);
  let r = await call(adminNotify, { action: 'send', audience: { kind: 'all' }, title: 'Studio closed', body: 'No class Thursday', tab: 'classes' }, boss.token);
  assert.equal(r.status, 200);
  assert.deepEqual(tokensSent(), [tok('ann-phone'), tok('anon-phone'), tok('ben-phone'), tok('boss-phone')].sort());
  assert.ok(sent.every(s => s.platform === 'android'));
  const all = (await adminDb().doc(`notifications/${r.body.id}`).get()).data()!;
  assert.deepEqual([all.title, all.audience, all.tab, all.devices, all.sentBy], ['Studio closed', 'all', 'classes', 4, boss.uid]);
  assert.ok(all.expireAt.toMillis() > Date.now() + 89 * 24 * 3600 * 1000);

  sent = [];
  const g = { kind: 'group', dance: 'WCS', level: '200' };
  assert.equal((await call(adminNotify, { action: 'count', audience: g }, boss.token)).body.devices, 1);
  r = await call(adminNotify, { action: 'send', audience: g, title: '200s', body: 'Workshop Saturday', tab: null }, boss.token);
  assert.equal(r.status, 200);
  assert.deepEqual(tokensSent(), [tok('ben-phone')]);
  // 100 level includes accounts with no stored level (ann, boss), not signed-out phones.
  assert.equal((await call(adminNotify, { action: 'count', audience: { kind: 'group', dance: 'WCS', level: '100' } }, boss.token)).body.devices, 2);

  for (const bad of [
    { action: 'send', audience: { kind: 'all' }, title: '', body: 'x' },
    { action: 'send', audience: { kind: 'all' }, title: 'x', body: 'y'.repeat(301) },
    { action: 'send', audience: { kind: 'group', dance: 'WCS', level: '300' }, title: 'x', body: 'y' },
    { action: 'send', audience: { kind: 'all' }, title: 'x', body: 'y', tab: 'calculator' },
  ]) assert.equal((await call(adminNotify, bad, boss.token)).status, 400);
});

test('the bell: app devices see "all" sends; group sends only at the right level; the web sees none', async () => {
  const titles = async (token?: string, platform = 'android') =>
    ((await call(mine, { platform }, token)).body.items as any[]).map(i => i.title);
  assert.ok((await titles()).includes('Studio closed'));
  assert.ok(!(await titles()).includes('200s'));
  assert.ok((await titles(ben.token)).includes('200s'));
  assert.ok(!(await titles(ann.token)).includes('200s'));
  assert.deepEqual(await titles(ben.token, 'web'), []);
});

test('dead tokens are removed when a send fails; deleting an account keeps its devices without the uid', async () => {
  dead.add(tok('anon-phone'));
  await call(adminNotify, { action: 'send', audience: { kind: 'all' }, title: 'Ping', body: 'Pong', tab: null }, boss.token);
  assert.equal((await adminDb().doc(`pushTokens/${tokenId(tok('anon-phone'))}`).get()).exists, false);
  const { deleteAccountData } = await import('../netlify/lib/accounts.mts');
  await deleteAccountData(cat.uid);
  assert.equal((await adminDb().doc(`pushTokens/${tokenId(tok('cat-web'))}`).get()).data()!.uid, null);
});
