# Season Pack Sort Controls

## Overview

Add two sort button toggles in the play-picker filter row, visible only when `intent === "download-season"`. Both are session-local state — no settings persistence, no storage, no other UI surface.

## Sort Controls

### Seed Count Sort (stream-level)

- Re-orders the displayed season-pack `ScoredStream[]` cards by seed count
- Cycles through: off → descending (highest seeds first) → ascending → off
- Pill label: `Seeds ▼`, `Seeds ▲`, hidden when off
- Applied reactively to the filtered picker stream list
- Useful for P2P users who want streams with more seeders

### File Size Sort (file-level)

- Re-orders the episode files inside the season pack before the fan-out enqueues downloads
- Cycles through: off → descending (largest files first) → ascending → off
- Pill label: `Size ▼`, `Size ▲`, hidden when off
- Stored as picker component state, consumed by the fan-out loop in `use-pick-handler.ts`
- The fan-out sorts `videoFiles[]` by `file.size` before iterating

## Implementation

### State

Two new `useState` in `PlayPicker`:

```ts
const [seedSort, setSeedSort] = useState<"asc" | "desc" | null>(null);
const [fileSizeSort, setFileSizeSort] = useState<"asc" | "desc" | null>(null);
```

### Pill Components

Two new pill components in `filter-pills.tsx` following the `CachedFilterPill` pattern. Rendered only when `intent === "download-season"`.

### Stream List Sort

The `filteredPicker` memo sorts streams by `seedSort` direction when set. Seeds come from `ScoredStream.seeds` field.

### Fan-Out Sort

In `use-pick-handler.ts` `resolveAndOpen`, after filtering `videoFiles`, sort by `fileSizeSort` direction using `file.size` before iterating.

## Files Changed

- `src/views/play-picker/filter-pills.tsx` — add `SeedSortPill` and `FileSizeSortPill` components
- `src/views/play-picker.tsx` — state, pass to pills, pass `fileSizeSort` to handler, sort streams in `filteredPicker`
- `src/views/play-picker/use-pick-handler.ts` — accept `fileSizeSort` in handler, sort in fan-out
