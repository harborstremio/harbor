import type { MusicTrack } from "./types";
export const queueTrackKey = (track: MusicTrack) =>
  `${track.collectionOrigin?.connectorId ?? track.connectorId ?? ""}:${track.collectionOrigin?.id ?? track.id}`;
type Modes = { shuffle: boolean; repeat: "off" | "all" | "one" };

/**
 * Listening order is separate from the album's stored order.
 *
 * Shuffle used to draw a random unvisited track at the moment of advancing, which meant the
 * order did not exist until it happened and Up next could only show the stored order, so it
 * showed the wrong songs with shuffle on. The shuffled order is now decided up front, as a
 * permutation the list can read ahead of. Playback and the list therefore agree by
 * construction rather than by accident.
 */
export class MusicQueueOrder {
  private visited = new Set<string>();
  private history: string[] = [];
  private forward: string[] = [];
  private order: string[] = [];
  private signature = "";

  reset() {
    this.visited.clear();
    this.history = [];
    this.forward = [];
    this.order = [];
    this.signature = "";
  }

  private shuffledOrder(queue: MusicTrack[], index: number, random: () => number): string[] {
    const keys = queue.map(queueTrackKey);
    const signature = `${keys.length}:${keys[0] ?? ""}:${keys[keys.length - 1] ?? ""}`;
    const currentKey = queue[index] ? queueTrackKey(queue[index]) : "";
    const known = new Set(this.order);
    const stale =
      this.signature !== signature ||
      this.order.length !== keys.length ||
      keys.some((key) => !known.has(key));
    if (!stale) return this.order;

    // The track already playing keeps its place at the head, the rest are dealt behind it.
    const rest = keys.filter((key) => key !== currentKey);
    for (let i = rest.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    this.order = currentKey ? [currentKey, ...rest] : rest;
    this.signature = signature;
    return this.order;
  }

  /** The tracks that will actually play next, so a list can show the truth. */
  upcoming(
    queue: MusicTrack[],
    index: number,
    modes: Modes,
    count: number,
    random = Math.random,
  ): MusicTrack[] {
    if (!queue.length || count <= 0) return [];
    if (modes.repeat === "one") return [];
    if (!modes.shuffle) {
      const ahead = queue.slice(index + 1, index + 1 + count);
      if (ahead.length >= count || modes.repeat !== "all") return ahead;
      return [...ahead, ...queue.slice(0, Math.max(0, count - ahead.length))];
    }
    const order = this.shuffledOrder(queue, index, random);
    const byKey = new Map(queue.map((track) => [queueTrackKey(track), track]));
    const currentKey = queue[index] ? queueTrackKey(queue[index]) : "";
    const at = order.indexOf(currentKey);
    const out: MusicTrack[] = [];
    // The queued "play next" picks are consumed first, so they lead the preview too.
    for (let i = this.forward.length - 1; i >= 0 && out.length < count; i -= 1) {
      const track = byKey.get(this.forward[i]);
      if (track) out.push(track);
    }
    for (let step = 1; step <= order.length && out.length < count; step += 1) {
      const position = at + step;
      if (position >= order.length && modes.repeat !== "all") break;
      const key = order[position % order.length];
      if (key === currentKey) continue;
      const track = byKey.get(key);
      if (track && !out.some((item) => queueTrackKey(item) === key)) out.push(track);
    }
    return out;
  }

  /** Where the back button would land, without consuming the history that answers it. */
  peekPrevious(queue: MusicTrack[], index: number, shuffle: boolean) {
    if (!shuffle) return queue[index - 1] ?? null;
    for (let at = this.history.length - 1; at >= 0; at -= 1) {
      const key = this.history[at];
      const previous = queue.find((track) => queueTrackKey(track) === key);
      if (previous) return previous;
    }
    return null;
  }

  previous(queue: MusicTrack[], index: number, shuffle: boolean) {
    if (!shuffle) return queue[index - 1] ?? null;
    while (this.history.length) {
      const key = this.history.pop();
      const previous = queue.find((track) => queueTrackKey(track) === key);
      if (previous) {
        if (queue[index]) this.forward.push(queueTrackKey(queue[index]));
        return previous;
      }
    }
    return null;
  }

  next(
    queue: MusicTrack[],
    index: number,
    modes: Modes,
    auto: boolean,
    priority?: MusicTrack | null,
    random = Math.random,
  ) {
    const current = queue[index];
    if (!queue.length) return null;
    if (auto && modes.repeat === "one") return current ?? null;
    const remember = (next: MusicTrack | null) => {
      if (next && current) {
        this.history.push(queueTrackKey(current));
        if (this.history.length > 500) this.history.shift();
      }
      return next;
    };
    if (current) this.visited.add(queueTrackKey(current));
    if (priority) {
      const next = queue.find(
        (track, at) => at !== index && queueTrackKey(track) === queueTrackKey(priority),
      );
      if (next) {
        this.forward = [];
        return remember(next);
      }
    }
    if (!modes.shuffle)
      return remember(queue[index + 1] ?? (modes.repeat === "all" ? queue[0] : null));
    while (this.forward.length) {
      const key = this.forward.pop();
      const next = queue.find((track) => queueTrackKey(track) === key);
      if (next) return remember(next);
    }
    const order = this.shuffledOrder(queue, index, random);
    const byKey = new Map(queue.map((track) => [queueTrackKey(track), track]));
    const currentKey = current ? queueTrackKey(current) : "";
    const at = order.indexOf(currentKey);
    for (let step = 1; step <= order.length; step += 1) {
      const position = at + step;
      if (position >= order.length && modes.repeat !== "all") break;
      const key = order[position % order.length];
      if (key === currentKey) continue;
      const track = byKey.get(key);
      if (!track) continue;
      if (this.visited.has(key)) {
        if (modes.repeat !== "all") continue;
        // A full lap under repeat-all starts the order again rather than stalling.
        this.visited.clear();
        if (currentKey) this.visited.add(currentKey);
      }
      return remember(track);
    }
    return remember(null);
  }
}
