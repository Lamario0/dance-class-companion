// Push notifications (slice 6): device tokens and sending through Firebase
// Cloud Messaging. Devices live in pushTokens/{sha256(token)} = { token,
// platform: 'android' | 'web', uid | null, updatedAt }, written only here.
import { createHash } from 'node:crypto';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import { getApps } from 'firebase-admin/app';
import { adminDb } from './firebaseAdmin.mts';

export type Platform = 'android' | 'web';
export const isPlatform = (p: unknown): p is Platform => p === 'android' || p === 'web';
export const tokenId = (token: string) => createHash('sha256').update(token).digest('hex');

export interface Device { id: string; token: string; platform: Platform; uid: string | null }

/** Sends one message to many tokens; resolves to per-token success/failure (error code). */
export type Sender = (msg: Omit<MulticastMessage, 'tokens'>, tokens: string[]) => Promise<Array<{ ok: boolean; code?: string }>>;

const fcm: Sender = async (msg, tokens) => {
  const out: Array<{ ok: boolean; code?: string }> = [];
  for (let i = 0; i < tokens.length; i += 500) {
    const r = await getMessaging(getApps()[0]).sendEachForMulticast({ ...msg, tokens: tokens.slice(i, i + 500) });
    r.responses.forEach(x => out.push({ ok: x.success, code: x.error?.code }));
  }
  return out;
};

let sender: Sender = fcm;
/** Tests: capture sends instead of calling FCM (null restores FCM). */
export const setSenderForTests = (s: Sender | null) => { sender = s ?? fcm; };

export const allDevices = async (): Promise<Device[]> =>
  (await adminDb().collection('pushTokens').get()).docs.map(d => {
    const x = d.data();
    return { id: d.id, token: x.token, platform: x.platform, uid: typeof x.uid === 'string' ? x.uid : null };
  }).filter(d => typeof d.token === 'string' && isPlatform(d.platform));

const DEAD = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);

/**
 * Sends to these devices, with separate payloads for Android and web, and
 * removes tokens FCM says are gone. Resolves to how many devices accepted it.
 */
export const sendTo = async (
  devices: Device[],
  build: (platform: Platform) => Omit<MulticastMessage, 'tokens'>,
) => {
  let sent = 0;
  const dead: string[] = [];
  for (const platform of ['android', 'web'] as const) {
    const list = devices.filter(d => d.platform === platform);
    if (!list.length) continue;
    let res: Array<{ ok: boolean; code?: string }>;
    try {
      res = await sender(build(platform), list.map(d => d.token));
    } catch (err) {
      console.error(`push send (${platform}) failed`, err); // e.g. FCM unreachable: nobody got it
      continue;
    }
    res.forEach((r, i) => {
      if (r.ok) sent++;
      else if (r.code && DEAD.has(r.code)) dead.push(list[i].id);
    });
  }
  if (dead.length) {
    const db = adminDb();
    for (let i = 0; i < dead.length; i += 400) {
      const b = db.batch();
      dead.slice(i, i + 400).forEach(id => b.delete(db.doc(`pushTokens/${id}`)));
      await b.commit();
    }
  }
  return { sent, removed: dead.length };
};

/** Tabs a notification may open. */
export const TABS = ['classes', 'media', 'news'] as const;
export type NotifyTab = (typeof TABS)[number];
export const isTab = (t: unknown): t is NotifyTab => typeof t === 'string' && (TABS as readonly string[]).includes(t);
