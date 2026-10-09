import type { Dispatch, RefObject, SetStateAction } from "react";

type Args = {
  paged: boolean;
  double: boolean;
  horizontal?: boolean;
  rtl?: boolean;
  total: number;
  currentPage: number;
  step: number;
  lastStart: number;
  nextIndex: number | null;
  prevIndex: number | null;
  autoNext: boolean;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  onChangeIndex: (i: number) => void;
  onEndReached?: () => void;
  pageEls: RefObject<Array<HTMLDivElement | null>>;
  scrollRef: RefObject<HTMLDivElement | null>;
};

export function useReaderPaging(a: Args) {
  const { paged, double, horizontal = false, rtl = false, total, currentPage, step, lastStart, nextIndex, prevIndex, autoNext, setCurrentPage, onChangeIndex, onEndReached, pageEls, scrollRef } = a;

  const goToPage = (p: number) => {
    if (paged) {
      const c = Math.max(0, Math.min(total, p));
      setCurrentPage(double && c < total ? c - (c % 2) : c);
      return;
    }
    const i = Math.max(0, Math.min(total - 1, p));
    pageEls.current[i]?.scrollIntoView(
      horizontal
        ? { behavior: "smooth", inline: "center", block: "nearest" }
        : { behavior: "smooth", block: "start" },
    );
    setCurrentPage(i);
  };

  const nextPage = () => {
    if (paged) {
      if (currentPage >= total) {
        if (nextIndex != null) onChangeIndex(nextIndex);
      } else if (currentPage >= lastStart) {
        onEndReached?.();
        if (autoNext && nextIndex != null) onChangeIndex(nextIndex);
        else setCurrentPage(total);
      } else {
        setCurrentPage((p) => p + step);
      }
    } else if (currentPage < total - 1) {
      goToPage(currentPage + 1);
    } else if (horizontal) {
      const root = scrollRef.current;
      if (root) root.scrollTo({ left: (rtl ? -1 : 1) * root.scrollWidth, behavior: "smooth" });
    } else {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  };

  const prevPage = () => {
    if (paged) {
      if (currentPage <= 0) {
        if (prevIndex != null) onChangeIndex(prevIndex);
      } else if (currentPage >= total) {
        setCurrentPage(lastStart);
      } else {
        setCurrentPage((p) => Math.max(0, p - step));
      }
    } else if (currentPage > 0) {
      goToPage(currentPage - 1);
    }
  };

  return { goToPage, nextPage, prevPage };
}
