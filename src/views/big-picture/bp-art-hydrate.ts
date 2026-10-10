// The awards row ships hundreds of cards with no art on purpose and every one of
// them hydrates when it scrolls into view, one or two requests each. Visibility
// bounds the burst per page-in, nothing bounded the burst against everything else
// happening at the same moment. A budget was the other option and it was wrong:
// a card denied its budget is a card with no art forever. This makes them wait.
const LANES = 4;

let active = 0;
const waiting: Array<() => void> = [];

export async function bpHydrateSlot<T>(run: () => Promise<T>): Promise<T> {
  if (active >= LANES) await new Promise<void>((resolve) => waiting.push(resolve));
  active += 1;
  try {
    return await run();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}
