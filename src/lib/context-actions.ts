import type { ReactNode } from "react";

/** IDs describe command + target, never the translated label. */
export type ContextAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  run?: () => void | Promise<void>;
  disabled?: boolean;
  reason?: string;
  danger?: boolean;
  group?: string;
  children?: ContextAction[];
  restoreFocus?: boolean;
};

export type ActionSource = {
  actions: () => ContextAction[];
  isValid?: () => boolean;
  subscribe?: (listener: () => void) => () => void;
};

export function composeActions(...groups: ContextAction[][]): ContextAction[] {
  const ids = new Set<string>();
  return groups.flat().filter((action) => {
    if (ids.has(action.id)) return false;
    ids.add(action.id);
    return true;
  });
}

export function findAction(actions: ContextAction[], id: string): ContextAction | undefined {
  for (const action of actions) {
    if (action.id === id) return action;
    const child = action.children && findAction(action.children, id);
    if (child)
      return action.disabled
        ? { ...child, disabled: true, reason: action.reason ?? child.reason }
        : child;
  }
  return undefined;
}

const running = new Set<string>();

export async function executeContextAction(
  source: ActionSource,
  id: string,
): Promise<{ restoreFocus: boolean }> {
  if (running.has(id)) throw new Error("This action is already running.");
  if (source.isValid?.() === false) throw new Error("This item is no longer available.");
  const action = findAction(source.actions(), id);
  if (!action || action.disabled || !action.run) {
    throw new Error(action?.reason || "This action is no longer available.");
  }
  running.add(id);
  try {
    await action.run();
    return { restoreFocus: action.restoreFocus !== false };
  } finally {
    running.delete(id);
  }
}

export function fitMenu(
  point: { x: number; y: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { x: number; y: number } {
  const inset = 8;
  return {
    x: Math.max(inset, Math.min(point.x, viewport.width - size.width - inset)),
    y: Math.max(inset, Math.min(point.y, viewport.height - size.height - inset)),
  };
}
