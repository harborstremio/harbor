import { useState, type ReactNode } from "react";

export function HoverNavIcon({ render }: { render: (hovered: boolean) => ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {render(hovered)}
    </span>
  );
}
