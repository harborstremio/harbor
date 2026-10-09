type BpBackHandler = () => boolean;

const handlers: BpBackHandler[] = [];

// Back pops one layer at a time. A nested dialog registers here so the shell's
// own chain never tears down the panel the dialog is sitting on.
export function pushBpBack(fn: BpBackHandler): () => void {
  handlers.push(fn);
  return () => {
    const at = handlers.indexOf(fn);
    if (at >= 0) handlers.splice(at, 1);
  };
}

export function runBpBack(): boolean {
  for (let i = handlers.length - 1; i >= 0; i -= 1) {
    if (handlers[i]()) return true;
  }
  return false;
}

if (typeof window !== "undefined") {
  (window as unknown as { __harborBack?: () => boolean }).__harborBack = runBpBack;
}
