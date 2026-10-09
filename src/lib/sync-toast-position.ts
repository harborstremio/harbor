export type SyncIndicatorPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "bottom-center";

const BASE = "pointer-events-none fixed z-[130] flex";

export function syncToastWrapClass(pos: SyncIndicatorPosition): string {
  const at =
    pos === "top-left"
      ? "top-16 start-6"
      : pos === "bottom-left"
        ? "bottom-24 start-6"
        : pos === "bottom-right"
          ? "bottom-24 end-6"
          : pos === "bottom-center"
            ? "inset-x-0 bottom-24 justify-center px-6"
            : "top-16 end-6";
  return `${BASE} ${at}`;
}
