// Home-screen class cards: one per active class slot in the app (Class slots
// page), in the admin's order. Patterns and notes come from the Classes
// worksheet as before. Until the slots load, or if they can't be read, the
// worksheet's own cards (`fallback`) are shown.
import { useEffect, useState } from 'react';
import type { DanceClass } from '../types';
import { loadSyllabus, slotCards, type Syllabus } from './dataService';
import { subscribeSlots, withSheet, type Slot } from './attendanceService';

export const useSlotCards = (fallback: DanceClass[]): DanceClass[] => {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [failed, setFailed] = useState(false);
  // undefined = loading; null = the worksheet couldn't be read
  const [syllabus, setSyllabus] = useState<Syllabus | null | undefined>(undefined);

  useEffect(() => subscribeSlots(s => { setSlots(s); setFailed(false); }, e => { console.warn('slots', e); setFailed(true); }), []);

  // Re-read the worksheet whenever the page's data reloads (same cache the data load just filled).
  useEffect(() => {
    let live = true;
    loadSyllabus().then(s => live && setSyllabus(s), () => live && setSyllabus(null));
    return () => { live = false; };
  }, [fallback]);

  if (failed || slots === null || syllabus === undefined) return fallback;
  const shown = slots.map(s => withSheet(s, syllabus));
  return slotCards(shown, syllabus?.classes ?? new Map());
};
