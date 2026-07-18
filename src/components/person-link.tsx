import { useCallback, useEffect, useRef, useState } from "react";
import { PersonHoverCard } from "./person-hover-card";

export function PersonLink({
  id,
  name,
  onClick,
  className,
}: {
  id: number;
  name: string;
  onClick: (id: number) => void;
  className?: string;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const clearOpen = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = null;
  };
  const clearClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const scheduleOpen = () => {
    clearClose();
    if (openTimer.current) return;
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      if (btnRef.current) setAnchor(btnRef.current.getBoundingClientRect());
    }, 380);
  };

  const scheduleClose = () => {
    clearOpen();
    if (closeTimer.current) return;
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setAnchor(null);
    }, 180);
  };

  const cancelClose = useCallback(() => clearClose(), []);

  useEffect(() => {
    if (!anchor) return;
    const onScroll = () => setAnchor(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [anchor]);

  useEffect(
    () => () => {
      clearOpen();
      clearClose();
    },
    [],
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onClick={(e) => {
          e.stopPropagation();
          clearOpen();
          clearClose();
          setAnchor(null);
          onClick(id);
        }}
        className={className}
      >
        {name}
      </button>
      {anchor && (
        <PersonHoverCard
          personId={id}
          anchor={anchor}
          onEnter={cancelClose}
          onLeave={scheduleClose}
        />
      )}
    </>
  );
}
