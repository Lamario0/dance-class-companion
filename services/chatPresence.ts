// Slice 6: whether the chat is on screen right now (no chat alerts then), when
// this device last looked at it (the bell's "new messages" count), and a way
// for a tapped notification to ask the News page to open the chat.

let visible = false;
let openRequested = false;
const SEEN_KEY = 'dcc-chat-seen';
const listeners = new Set<() => void>();

export const setChatVisible = (v: boolean) => {
  visible = v;
  if (v) markChatSeen();
};
export const isChatVisible = () => visible && document.visibilityState === 'visible';

export const chatSeenAt = (): number => {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
};
export const markChatSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    /* private mode: the count just stays */
  }
  listeners.forEach(l => l());
};
/** Called when the chat's "last seen" changes. */
export const onChatSeen = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

/** A notification asked for the chat: the News page opens on it (once). */
export const requestChat = () => {
  openRequested = true;
  window.dispatchEvent(new Event('dcc:open-chat'));
};
export const takeChatRequest = () => {
  const r = openRequested;
  openRequested = false;
  return r;
};
