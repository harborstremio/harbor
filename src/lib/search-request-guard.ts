export type SearchRequestGuard = {
  begin: () => number;
  isCurrent: (id: number) => boolean;
};

export function createSearchRequestGuard(): SearchRequestGuard {
  let current = 0;

  return {
    begin: () => ++current,
    isCurrent: (id) => id === current,
  };
}
