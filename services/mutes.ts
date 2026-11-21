// Chat mutes (slice 6). Pure helpers shared by the app and the server.
// A mute is stored on the muting account (users/{uid}.muted) as { k, n }:
// k = "u:<uid>" for an account, "g:<lower-cased name>" for a guest; n = the
// name to show in "Muted people".

export interface Mute { k: string; n: string }
export const MAX_MUTES = 200;

/** The key a chat message's author is muted by. */
export const muteKey = (m: { uid?: string | null; author: string }) =>
  m.uid ? `u:${m.uid}` : `g:${m.author.trim().toLowerCase()}`;

export const isMute = (v: unknown): v is Mute =>
  !!v && typeof (v as Mute).k === 'string' && /^(u|g):.{1,128}$/.test((v as Mute).k) && typeof (v as Mute).n === 'string' && (v as Mute).n.length <= 60;

/** Muted entries from a stored value (anything malformed is ignored). */
export const readMutes = (v: unknown): Mute[] => (Array.isArray(v) ? v.filter(isMute).slice(0, MAX_MUTES) : []);
