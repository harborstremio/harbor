import { useId, useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import "./match-disclosure.css";

export function MatchDisclosure({
  title,
  icon: Icon,
  count,
  scroll = true,
  children,
}: {
  title: string;
  icon: LucideIcon;
  count?: string;
  scroll?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [visited, setVisited] = useState(false);
  return (
    <details
      className="sh-match-disclosure"
      onToggle={(event) => {
        if (event.currentTarget.open) setVisited(true);
      }}
    >
      <summary tabIndex={0}>
        <Icon size={19} aria-hidden="true" />
        <strong id={id}>{title}</strong>
        {count && <span className="sh-match-disclosure-count">{count}</span>}
        <ChevronDown size={18} className="sh-match-disclosure-chevron" aria-hidden="true" />
      </summary>
      {/* Mount on first use, then retain table selection and scroll when closed. */}
      {visited && (
        <div
          className={`sh-match-disclosure-body${scroll ? " is-scrollable" : ""}`}
          role="region"
          aria-labelledby={id}
          tabIndex={scroll ? 0 : undefined}
        >
          {children}
        </div>
      )}
    </details>
  );
}
