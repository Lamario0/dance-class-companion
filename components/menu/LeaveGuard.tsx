import React, { createContext, useContext } from 'react';

/**
 * Lets anything that moves away from the Notes page (nav tabs, the left menu,
 * signing out) ask "Discard your changes?" first when a note has unsaved edits.
 */
export interface LeaveGuard {
  /** run `action`, asking first if the Notes page has unsaved edits */
  guardLeave: (action: () => void) => void;
  /** the Notes page reports whether it has unsaved edits */
  setNotesDirty: (dirty: boolean) => void;
}

const Ctx = createContext<LeaveGuard>({ guardLeave: a => a(), setNotesDirty: () => {} });
export const LeaveGuardProvider = Ctx.Provider;
export const useLeaveGuard = () => useContext(Ctx);
