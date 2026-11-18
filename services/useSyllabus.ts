// The Classes + Slots worksheets for React pages (attendance slice 3A).
import { useEffect, useState } from 'react';
import { loadSyllabus, type Syllabus } from './dataService';

/** The syllabus, or null while loading / if the sheet can't be read. Bump `version` to refetch. */
export const useSyllabus = (version = 0) => {
  const [s, setS] = useState<Syllabus | null>(null);
  useEffect(() => {
    let live = true;
    loadSyllabus(version > 0).then(x => live && setS(x), e => console.warn('syllabus', e));
    return () => { live = false; };
  }, [version]);
  return s;
};
