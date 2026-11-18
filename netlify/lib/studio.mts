// The studio's calendar (attendance spec): "once per day" means the studio's
// day in Grand Rapids, not the phone's or the server's time zone.
export const STUDIO_TZ = 'America/Detroit';

/** YYYY-MM-DD of `at` in the studio's time zone. */
export const studioDate = (at: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

/** Check-in document id: one per slot, studio day and person. */
export const checkinId = (slotId: string, date: string, uid: string) => `${slotId}__${date}__${uid}`;

/** Check-in id for a guest (no account): the person part is `g_<guestId>`. */
export const guestCheckinId = (slotId: string, date: string, guestId: string) => checkinId(slotId, date, `g_${guestId}`);

/** True for a real calendar date written YYYY-MM-DD. */
export const isIsoDate = (d: unknown): d is string => {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(`${d}T12:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
};

export const SLOT_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const CHECKIN_ID = /^[A-Za-z0-9_-]{1,64}__\d{4}-\d{2}-\d{2}__[A-Za-z0-9_-]{1,140}$/;
