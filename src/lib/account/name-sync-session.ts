export type NameSyncPhase = "idle" | "saving" | "saved" | "error";

const usable = (name: string) => !!name && !/^Guest \d+$/.test(name);

/** One account's sync lifetime. New edits supersede reads; writes stay ordered. */
export function createNameSyncSession(options: {
  name: string;
  load: () => Promise<string | null>;
  save: (name: string) => Promise<void>;
  apply: (name: string) => void;
  status: (phase: NameSyncPhase) => void;
}) {
  let name = options.name.trim().slice(0, 32);
  let revision = 0;
  let confirmed: string | null = null;
  let ready = false;
  let loading = false;
  let saving = false;
  let disposed = false;

  const flush = async () => {
    if (disposed || !ready || saving || !usable(name) || name === confirmed) return;
    saving = true;
    options.status("saving");
    try {
      while (!disposed && usable(name) && name !== confirmed) {
        const requested = name;
        await options.save(requested);
        if (disposed) return;
        confirmed = requested;
      }
      if (!disposed) options.status("saved");
    } catch {
      if (!disposed) options.status("error");
    } finally {
      saving = false;
    }
  };

  const load = async () => {
    if (disposed || loading || ready) return;
    loading = true;
    options.status("saving");
    try {
      const alias = await options.load();
      if (disposed) return;
      confirmed = alias;
      ready = true;
      if (revision === 0 && alias && usable(alias)) {
        name = alias;
        options.apply(alias);
      }
      if (usable(name) && name !== confirmed) await flush();
      else options.status("idle");
    } catch {
      if (!disposed) options.status("error");
    } finally {
      loading = false;
    }
  };

  return {
    start: load,
    update(next: string) {
      const normalized = next.trim().slice(0, 32);
      if (name === normalized) return;
      name = normalized;
      revision += 1;
      void flush();
    },
    retry() {
      return ready ? flush() : load();
    },
    dispose() {
      disposed = true;
    },
  };
}
