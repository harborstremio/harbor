import type { ReactNode } from "react";

export type ActionConfirmation = {
  /** Includes the actor, target, and destructive scope/version. */
  key: string;
  title: string;
  description: string;
  /** Concise target and scope for the local confirmation; description retains details. */
  summary?: string;
  confirmLabel: string;
  pendingLabel?: string;
  successLabel: string;
};

/** IDs describe command + target, never the translated label. */
export type ContextAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  run?: () => void | Promise<void>;
  disabled?: boolean;
  reason?: string;
  /** Target descriptions should appear only after intentional menu exploration. */
  tooltipIntent?: "deliberate";
  danger?: boolean;
  active?: boolean;
  /** Independent membership state, never a mutually exclusive choice. */
  checked?: boolean;
  dismiss?: "on-success" | "keep-open";
  confirmation?: ActionConfirmation;
  quickCopy?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  submenuVariant?: "navigation";
  shortcut?: string;
  group?: string;
  /** Non-interactive label shown once at the start of this consecutive section. */
  sectionLabel?: string;
  children?: ContextAction[];
  restoreFocus?: boolean;
};

export type ActionSource = {
  actions: () => ContextAction[];
  isValid?: () => boolean;
  subscribe?: (listener: () => void) => () => void;
};

export function filterContextActions(actions: ContextAction[], query: string): ContextAction[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return actions;
  return actions.filter(
    (action) => action.group === "create" || action.label.toLocaleLowerCase().includes(needle),
  );
}

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
  options: { confirmationKey?: string } = {},
): Promise<{ restoreFocus: boolean; dismiss: "on-success" | "keep-open" }> {
  if (running.has(id)) throw new Error("This action is already running.");
  if (source.isValid?.() === false) throw new Error("This item is no longer available.");
  const action = findAction(source.actions(), id);
  if (!action || action.disabled || !action.run) {
    throw new Error(action?.reason || "This action is no longer available.");
  }
  if (
    (action.confirmation || options.confirmationKey !== undefined) &&
    options.confirmationKey !== action.confirmation?.key
  ) {
    throw new Error(
      options.confirmationKey
        ? "This action has changed. Review its confirmation again."
        : "This action requires confirmation.",
    );
  }
  running.add(id);
  try {
    await action.run();
    return {
      restoreFocus: action.restoreFocus !== false,
      dismiss: action.dismiss ?? (action.confirmation ? "keep-open" : "on-success"),
    };
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
