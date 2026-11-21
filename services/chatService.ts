// Community chat, stored in Firestore (`chatMessages`).
//
// Quarterly reset: every message is stamped with the quarter it was posted in
// ("2026-Q4") and the app only shows the current quarter, so the chat starts
// fresh on Jan 1 / Apr 1 / Jul 1 / Oct 1. Each message also carries `expireAt`
// (the start of the next quarter); a Firestore TTL policy on that field deletes
// old messages for good.
//
// Identity (spec slice 3):
// - Guests (and unverified accounts) post under any name; no edit/delete.
// - Members (verified accounts) post with `uid` under their profile name and can
//   edit or delete their own messages. Deleting one that has replies leaves
//   "This message was deleted" so the replies stay.
// - Admins (custom claim) can edit or delete any message.
// All of this is enforced by firestore.rules.
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { apiUrl } from './platform';

export type ChatRole = 'member' | 'admin';

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  parentId: string | null;
  createdAt: Date | null; // null until the server timestamp lands
  /** set on members' posts; absent for guests and deleted accounts */
  uid: string | null;
  role: ChatRole | null;
  edited: boolean;
  deleted: boolean;
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
            text: data.text ?? '',
            parentId: data.parentId ?? null,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
            uid: typeof data.uid === 'string' ? data.uid : null,
            role: data.role === 'admin' || data.role === 'member' ? data.role : null,
            edited: !!data.editedAt && !data.deleted,
            deleted: data.deleted === true,
          };
        }),
      );
    },
    onError,
  );
};

/** A member's identity on a post; omit for guests. */
export interface PostAs {
  uid: string;
  role: ChatRole;
}

/** Slice 6: ask the server to notify everyone about this new message (fire and forget). */
const notifyChat = (id: string) => {
  fetch(apiUrl('/api/chat-notify'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    .catch(err => console.warn('chat notify', err));
};

export const postChatMessage = async (author: string, text: string, parentId: string | null = null, as?: PostAs) => {
  const now = new Date();
  const ref = await addDoc(collection(db, COLLECTION), {
    author: author.trim().slice(0, MAX_AUTHOR),
    text: text.trim().slice(0, MAX_TEXT),
    parentId,
    quarter: quarterOf(now),
    createdAt: serverTimestamp(),
    expireAt: Timestamp.fromDate(nextQuarterStart(now)),
    ...(as ? { uid: as.uid, role: as.role } : {}),
  });
  notifyChat(ref.id);
  return ref;
};

/** Edit a message's text (own message, or any as admin). */
export const editChatMessage = (id: string, text: string) =>
  updateDoc(doc(db, COLLECTION, id), { text: text.trim().slice(0, MAX_TEXT), editedAt: serverTimestamp() });

/**
 * Delete a message (own, or any as admin). Always a soft delete: the text is
 * wiped and the message hidden, unless it has replies, in which case it shows
 * "This message was deleted" so the conversation under it stays readable. (A
 * hard delete could orphan a reply this device hasn't seen yet.) The empty
 * document is removed by the quarterly TTL.
 */
export const deleteChatMessage = (id: string) =>
  updateDoc(doc(db, COLLECTION, id), { text: '', deleted: true, editedAt: serverTimestamp() });

/** Flat list → threads. Newest top-level first, replies oldest first. */
export const buildThreads = (messages: ChatMessage[]): ChatThread[] => {
  const byId = new Map<string, ChatThread>();
  messages.forEach(m => byId.set(m.id, { ...m, replies: [] }));
  const roots: ChatThread[] = [];
  byId.forEach(m => {
    const parent = m.parentId ? byId.get(m.parentId) : undefined;
    if (parent) parent.replies.push(m);
    else if (!m.parentId) roots.push(m);
    // a reply whose parent was hard-deleted is dropped along with it
  });
  const t = (m: ChatMessage) => m.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const sortReplies = (list: ChatThread[]) => {
    list.sort((a, b) => t(a) - t(b));
    list.forEach(r => sortReplies(r.replies));
  };
  // A soft-deleted message whose replies are all gone has nothing left to show.
  const prune = (list: ChatThread[]): ChatThread[] =>
    list
      .map(m => ({ ...m, replies: prune(m.replies) }))
      .filter(m => !m.deleted || m.replies.length > 0);
  const kept = prune(roots);
  kept.sort((a, b) => t(b) - t(a));
  kept.forEach(r => sortReplies(r.replies));
  return kept;
};
