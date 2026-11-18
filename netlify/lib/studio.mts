// The studio's calendar (attendance spec): "once per day" means the studio's
// day in Grand Rapids, not the phone's or the server's time zone.
export const STUDIO_TZ = 'America/Detroit';

/** YYYY-MM-DD of `at` in the studio's time zone. */
export const studioDate = (at: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

/** Check-in document id: one per slot, studio day and person. */
export const checkinId = (slotId: string, date: string, uid: string) => `${slotId}__${date}__${uid}`;
