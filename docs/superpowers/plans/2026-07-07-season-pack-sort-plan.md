# Season Pack Sort Controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seed and file-size sort toggles in the picker, visible only during `download-season`.

**Architecture:** Two new pill components in `filter-pills.tsx`, session-local `useState` in `PlayPicker`, seed sort applied reactively to stream list, file-size sort passed to handler and applied in fan-out.

**Tech Stack:** React, TypeScript, existing `CachedFilterPill` pattern.

---

### Task 1: Seed and File Size Sort Pill Components

**Files:**
- Modify: `src/views/play-picker/filter-pills.tsx`

- [ ] **Add two new pill components**

```typescript
import { ArrowDownUp, ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";

function SortPill({
  label,
  value,
  onCycle,
}: {
  label: string;
  value: "asc" | "desc" | null;
  onCycle: () => void;
}) {
  if (!value) {
    return (
      <button
        onClick={onCycle}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle/80 transition-colors hover:bg-canvas/60 hover:text-ink-muted"
      >
        <ArrowDownUp size={11} strokeWidth={2.2} />
        {label}
      </button>
    );
  }
  const desc = value === "desc";
  return (
    <button
      onClick={onCycle}
      className="flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-accent transition-colors hover:bg-accent/22"
    >
      {desc ? (
        <ArrowDownWideNarrow size={11} strokeWidth={2.2} />
      ) : (
        <ArrowUpWideNarrow size={11} strokeWidth={2.2} />
      )}
      {label} {desc ? "▼" : "▲"}
    </button>
  );
}

export const SeedSortPill = (props: { value: "asc" | "desc" | null; onCycle: () => void }) => <SortPill label="Seeds" {...props} />;
export const FileSizeSortPill = (props: { value: "asc" | "desc" | null; onCycle: () => void }) => <SortPill label="Size" {...props} />;
```

### Task 2: Wire sort state and pass to handler

**Files:**
- Modify: `src/views/play-picker.tsx`

- [ ] **Add sort state and cycle handlers**

Add inside the component body, near the other filter state:

```typescript
const [seedSort, setSeedSort] = useState<"asc" | "desc" | null>(null);
const [fileSizeSort, setFileSizeSort] = useState<"asc" | "desc" | null>(null);

const cycleSeedSort = useCallback(() => {
  setSeedSort((prev) => (prev === null ? "desc" : prev === "desc" ? "asc" : null));
}, []);

const cycleFileSizeSort = useCallback(() => {
  setFileSizeSort((prev) => (prev === null ? "desc" : prev === "desc" ? "asc" : null));
}, []);
```

- [ ] **Apply seed sort to filtered stream list**

In the `filteredPicker` useMemo, after the existing filters, add:

```typescript
if (seedSort && all.length > 1) {
  const sorted = [...all].sort((a, b) => {
    const sa = a.seeders ?? 0;
    const sb = b.seeders ?? 0;
    return seedSort === "desc" ? sb - sa : sa - sb;
  });
  all = sorted;
}
```

- [ ] **Render pills only for download-season**

Find the existing `CachedFilterPill` / `LanguageFilterPill` rendering area and add the sort pills guarded by `intent === "download-season"`:

```typescript
{intent === "download-season" && (
  <>
    <SeedSortPill value={seedSort} onCycle={cycleSeedSort} />
    <FileSizeSortPill value={fileSizeSort} onCycle={cycleFileSizeSort} />
  </>
)}
```

- [ ] **Pass fileSizeSort to usePickHandler**

Add `fileSizeSort` to the `usePickHandler` call:

```typescript
fileSizeSort,
```

### Task 3: Accept fileSizeSort and sort in fan-out

**Files:**
- Modify: `src/views/play-picker/use-pick-handler.ts`

- [ ] **Accept fileSizeSort prop**

Add `fileSizeSort` to the `usePickHandler` params type:

```typescript
fileSizeSort?: "asc" | "desc" | null;
```

Add to destructured props in the function signature.

- [ ] **Sort videoFiles in fan-out before iterating**

In `resolveAndOpen`, after filtering `videoFiles` and before the `for` loop at line 144, add sort:

```typescript
if (fileSizeSort) {
  videoFiles.sort((a, b) => {
    return fileSizeSort === "desc" ? b.size - a.size : a.size - b.size;
  });
}
```
