import type { ReactNode } from "react";
import type { ActionSource } from "./context-actions";
import type { CwDismissResult } from "./cw-dismiss";
import type { LibraryItem } from "./stremio";

export type ContinueDismiss = (
  item: LibraryItem,
) => void | CwDismissResult | Promise<void | CwDismissResult>;

export function continueCardIdentity(item: LibraryItem): string {
  return JSON.stringify([
    item._id,
    item.type,
    item.external,
    item.local,
    item.manualWatched,
    item.state?.video_id,
    item.state?.season,
    item.state?.episode,
    item.upNext,
  ]);
}

/** One entry owns its original controls and menu commands, including pending work. */
export function createContinueCardActions(options: {
  item: LibraryItem;
  getItem: () => LibraryItem;
  isCurrent: () => boolean;
  isAvailable: () => boolean;
  t: (key: string) => string;
  play: (assertCurrent: () => void) => Promise<void>;
  chooseSource: (assertCurrent: () => void) => Promise<void>;
  dismiss?: () => void | CwDismissResult | Promise<void | CwDismissResult>;
  onDismissed?: (result: void | CwDismissResult) => void;
  onError?: (error: unknown) => void;
  icons?: { play: ReactNode; sources: ReactNode; dismiss: ReactNode };
}) {
  const identity = continueCardIdentity(options.item);
  const listeners = new Set<() => void>();
  let pending = false;
  let removed = false;
  const waitingForAir = () =>
    (options.getItem() as LibraryItem & { waitingForAir?: boolean }).waitingForAir === true;
  const isValid = () =>
    !removed &&
    options.isCurrent() &&
    continueCardIdentity(options.getItem()) === identity &&
    options.isAvailable();
  const assertCurrent = () => {
    if (!isValid())
      throw new Error(options.t("This Continue Watching entry is no longer available."));
  };
  const emit = () => listeners.forEach((listener) => listener());
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const run = async (kind: "play" | "sources" | "dismiss") => {
    if (pending) throw new Error(options.t("This action is already running."));
    assertCurrent();
    if (kind !== "dismiss" && waitingForAir())
      throw new Error(options.t("This episode has not aired yet."));
    pending = true;
    emit();
    try {
      if (kind === "dismiss") {
        if (!options.dismiss) throw new Error(options.t("This action is no longer available."));
        const result = await options.dismiss();
        removed = true;
        if (options.isCurrent()) options.onDismissed?.(result);
      } else {
        await (kind === "play" ? options.play : options.chooseSource)(assertCurrent);
      }
    } catch (error) {
      if (options.isCurrent()) options.onError?.(error);
      throw error;
    } finally {
      pending = false;
      emit();
    }
  };
  const primary: ActionSource = {
    isValid,
    subscribe,
    actions: () => {
      const disabled = pending || !isValid() || waitingForAir();
      const reason = waitingForAir() ? options.t("This episode has not aired yet.") : undefined;
      return [
        {
          id: `continue:play:${identity}`,
          label: options.t("Continue watching"),
          icon: options.icons?.play,
          disabled,
          reason,
          restoreFocus: false,
          run: () => run("play"),
        },
        {
          id: `continue:sources:${identity}`,
          label: options.t("Choose another source"),
          icon: options.icons?.sources,
          disabled,
          reason,
          restoreFocus: false,
          run: () => run("sources"),
        },
      ];
    },
  };
  const extra: ActionSource = {
    isValid,
    subscribe,
    actions: () =>
      options.dismiss
        ? [
            {
              id: `continue:dismiss:${identity}`,
              label: options.t("Remove from Continue Watching"),
              icon: options.icons?.dismiss,
              disabled: pending || !isValid(),
              restoreFocus: false,
              run: () => run("dismiss"),
            },
          ]
        : [],
  };
  return {
    isValid,
    primary,
    extra,
    subscribe,
    isPending: () => pending,
    play: () => run("play"),
    chooseSource: () => run("sources"),
    dismiss: () => run("dismiss"),
  };
}
