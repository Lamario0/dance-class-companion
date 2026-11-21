// Class slot display order (pure, so tests can import it without Firebase).

/** Admin-set order first; slots never ordered keep creation order after them. */
export const sortSlots = <T extends { order?: number }>(slots: T[]) =>
  slots.map((s, i) => [s, i] as const)
    .sort(([a, i], [b, j]) => (a.order ?? Infinity) - (b.order ?? Infinity) || i - j)
    .map(([s]) => s);
