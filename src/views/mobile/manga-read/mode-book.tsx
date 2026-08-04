import { useMemo } from "react";
import { BookFlip } from "@/views/manga/manga-reader/book-view";
import { proxied, READER_BG_HEX } from "./local-reader-types";

export function ModeBook({
  pages,
  rtl,
  resumePage,
  onProgress,
}: {
  pages: string[];
  rtl: boolean;
  resumePage: number;
  onProgress: (page: number, spread: string) => void;
}) {
  const proxiedPages = useMemo(() => pages.map(proxied), [pages]);

  return (
    <div className="h-full w-full">
      <BookFlip
        pages={proxiedPages}
        rtl={rtl}
        bg={READER_BG_HEX}
        resumePage={resumePage}
        soundEnabled={true}
        onProgress={onProgress}
      />
    </div>
  );
}
