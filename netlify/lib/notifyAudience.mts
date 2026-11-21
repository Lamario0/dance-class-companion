// Slice 6: who an admin notification reaches. Android app devices only.
//   all   - every Android device (signed in or not)
//   group - signed-in Android devices whose account is at `level` in `dance`
//           (no stored level in that dance counts as 100)
import { adminDb } from './firebaseAdmin.mts';
import { allDevices, type Device } from './push.mts';
import { isLevel, type Level } from '../../services/levels.ts';

export type Audience = { kind: 'all' } | { kind: 'group'; dance: string; level: Level };

const validDance = (d: unknown): d is string => typeof d === 'string' && d.trim().length > 0 && d.length <= 40 && !/[.`/]/.test(d);

export const parseAudience = (a: any): Audience | null => {
  if (a?.kind === 'all') return { kind: 'all' };
  if (a?.kind === 'group' && validDance(a.dance) && isLevel(a.level)) return { kind: 'group', dance: a.dance, level: a.level };
  return null;
};

/** The level each of these accounts has in `dance`. */
export const levelsIn = async (uids: string[], dance: string) => {
  const db = adminDb();
  const out = new Map<string, Level>();
  for (let i = 0; i < uids.length; i += 300) {
    const snaps = await db.getAll(...uids.slice(i, i + 300).map(u => db.doc(`levels/${u}`)));
    snaps.forEach(s => {
      const l = s.data()?.dances?.[dance]?.level;
      out.set(s.id, isLevel(l) ? l : '100');
    });
  }
  return out;
};

export const audienceDevices = async (a: Audience): Promise<Device[]> => {
  const app = (await allDevices()).filter(d => d.platform === 'android');
  if (a.kind === 'all') return app;
  const signedIn = app.filter(d => d.uid);
  const lv = await levelsIn([...new Set(signedIn.map(d => d.uid!))], a.dance);
  return signedIn.filter(d => lv.get(d.uid!) === a.level);
};
