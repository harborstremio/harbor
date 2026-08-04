import type { CSSProperties } from "react";
import { ProxiedImg } from "./proxied-img";

export function ModePaged({
  pages,
  anchor,
  total,
  rtl,
  double,
  onTurn,
  onToggleChrome,
}: {
  pages: string[];
  anchor: number;
  total: number;
  rtl: boolean;
  double: boolean;
  onTurn: (dir: "next" | "prev") => void;
  onToggleChrome: () => void;
}) {
  const pair = [anchor, anchor + 1].filter((i) => i < total);
  const ordered = double ? (rtl ? pair.slice().reverse() : pair) : [anchor];
  const solo = ordered.length <= 1;

  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / Math.max(1, rect.width);
    if (x < 0.33) onTurn(rtl ? "next" : "prev");
    else if (x > 0.67) onTurn(rtl ? "prev" : "next");
    else onToggleChrome();
  };

  const imgStyle: CSSProperties = { maxWidth: solo ? "100%" : "50%", maxHeight: "100%" };

  return (
    <div
      className="flex h-full w-full touch-none select-none items-center justify-center gap-1 px-1"
      onClick={onTap}
    >
      {ordered.map((i) => (
        <ProxiedImg
          key={`${i}:${pages[i]}`}
          url={pages[i] ?? ""}
          className="block object-contain"
          style={imgStyle}
        />
      ))}
    </div>
  );
}
