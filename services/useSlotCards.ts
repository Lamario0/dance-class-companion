// Home-screen class cards: one per active class slot in the app (Class slots
// page), in the admin's order. Patterns and notes come from the Classes
// worksheet as before. Until the slots load, or if they can't be read, the
// worksheet's own cards (`fallback`) are shown.
// attendanceService (and with it Firebase) is loaded lazily, after first paint,
// so it stays out of the main bundle.
import { useEffect, useState } from 'react';
import type { DanceClass } from '../types';
import { loadSyllabus, slotCards, type SheetSlot, type Syllabus } from './dataService';

type Slot = SheetSlot & { order?: number };

/** The slot as the Slots worksheet has it (the sheet wins when it has a row). Same as attendanceService.withSheet. */
const withSheet = (slot: Slot, s: Syllabus | null): Slot => {
  const row = s?.slots.find(x => x.id === slot.id);
  return row ? { ...slot, label: row.label || slot.label, title: row.title || slot.title } : slot;
};

export const useSlotCards = (fallback: DanceClass[]): DanceClass[] => {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [failed, setFailed] = useState(false);
  // undefined = loading; null = the worksheet couldn't be read
  const [syllabus, setSyllabus] = useState<Syllabus | null | undefined>(undefined);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let live = true;
    import('./attendanceService').then(
      a => {
        if (!live) return;
        unsub = a.subscribeSlots(s => { setSlots(s); setFailed(false); }, e => { console.warn('slots', e); setFailed(true); });
      },
      e => { console.warn('slots', e); if (live) setFailed(true); },
    );
    return () => { live = false; unsub?.(); };
  }, []);

  // Re-read the worksheet whenever the page's data reloads (same cache the data load just filled).
  useEffect(() => {
    let live = true;
    loadSyllabus().then(s => live && setSyllabus(s), () => live && setSyllabus(null));
    return () => { live = false; };
  }, [fallback]);

  if (failed || slots === null || syllabus === undefined) return fallback;
  return slotCards(slots.map(s => withSheet(s, syllabus)), syllabus?.classes ?? new Map());
};
