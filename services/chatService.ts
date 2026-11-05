// Community chat, stored in Firestore (`chatMessages`).
//
// Quarterly reset: every message is stamped with the quarter it was posted in
// ("2026-Q4") and the app only shows the current quarter, so the chat starts
// fresh on Jan 1 / Apr 1 / Jul 1 / Oct 1. Each message also carries `expireAt`
// (the start of the next quarter); a Firestore TTL policy on that field deletes
// old messages for good.
//
// Anyone can read and post (validated by firestore.rules). Editing and deleting
// are instructor-only and go through the /api/chat-moderate Netlify function.
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  parentId: string | null;
  createdAt: Date | null; // null until the server timestamp lands
}

export interface ChatThread extends ChatMessage {
  replies: ChatThread[];
}

const COLLECTION = 'chatMessages';
const MAX_MESSAGES = 500;
export const MAX_AUTHOR = 40;
export const MAX_TEXT = 1000;

export const quarterOf = (d: Date) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;

/** First moment of the next quarter (local time). */
export const nextQuarterStart = (d: Date) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 1);

/** Live list of this quarter's messages. Returns an unsubscribe function. */
export const subscribeToChat = (
  onChange: (messages: ChatMessage[]) => void,
  onError: (err: Error) => void,
) => {
  const q = query(collection(db, COLLECTION), where('quarter', '==', quarterOf(new Date())), limit(MAX_MESSAGES));
  return onSnapshot(
    q,
    snap => {
      onChange(
        snap.docs.map(d => {
          const data = d.data({ serverTimestamps: 'estimate' });
          return {
            id: d.id,
            author: data.author,
            text: data.text,
            parentId: data.parentId ?? null,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
          };
        }),
      );
    },
    onError,
  );
};

export const postChatMessage = (author: string, text: string, parentId: string | null = null) => {
  const now = new Date();
  return addDoc(collection(db, COLLECTION), {
    author: author.trim().slice(0, MAX_AUTHOR),
    text: text.trim().slice(0, MAX_TEXT),
    parentId,
    quarter: quarterOf(now),
    createdAt: serverTimestamp(),
    expireAt: Timestamp.fromDate(nextQuarterStart(now)),
  });
};

/** Flat list → threads. Newest top-level first, replies oldest first. */
export const buildThreads = (messages: ChatMessage[]): ChatThread[] => {
  const byId = new Map<string, ChatThread>();
  messages.forEach(m => byId.set(m.id, { ...m, replies: [] }));
  const roots: ChatThread[] = [];
  byId.forEach(m => {
    const parent = m.parentId ? byId.get(m.parentId) : undefined;
    if (parent) parent.replies.push(m);
    else if (!m.parentId) roots.push(m);
    // a reply whose parent was deleted is dropped along with it
  });
  const t = (m: ChatMessage) => m.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const sortReplies = (list: ChatThread[]) => {
    list.sort((a, b) => t(a) - t(b));
    list.forEach(r => sortReplies(r.replies));
  };
  roots.sort((a, b) => t(b) - t(a));
  roots.forEach(r => sortReplies(r.replies));
  return roots;
};

/** Instructor-only edit/delete through the Netlify function (Admin SDK). */
export const moderateChat = async (
  adminToken: string,
  action: { type: 'edit'; id: string; text: string } | { type: 'delete'; id: string },
) => {
  const res = await fetch('/api/chat-moderate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(action),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
};
