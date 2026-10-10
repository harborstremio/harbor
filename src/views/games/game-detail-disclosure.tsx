import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export const DetailExpansion = createContext({ all: false, roomy: true, scope: "" });
const choices = new Map<string, boolean>();

export function DetailDisclosure({ title, note, icon, prominent = false, children, className = "" }: { title: string; note?: ReactNode; icon?: ReactNode; prominent?: boolean; children: ReactNode; className?: string }) {
  const { all, roomy, scope } = useContext(DetailExpansion), key = `${scope}:${title}`, previousAll = useRef(all);
  const [choice, setChoice] = useState<boolean | null>(() => scope ? choices.get(key) ?? null : null);
  useEffect(() => { if (previousAll.current !== all) { setChoice(null); choices.delete(key); previousAll.current = all; } }, [all, key]);
  const open = choice ?? (all || (roomy && prominent));
  return <details className={`games-detail-disclosure ${className}`} open={open} onToggle={event => { if (event.currentTarget.open !== open) { const value = event.currentTarget.open; setChoice(value); if (scope) { choices.delete(key); choices.set(key, value); if (choices.size > 240) choices.delete(choices.keys().next().value!); } } }}>
    <summary>{icon && <span className="games-detail-disclosure-icon" aria-hidden="true">{icon}</span>}<span className="games-detail-disclosure-title"><span>{title}</span>{note && <small>{note}</small>}</span><ChevronDown className="games-detail-disclosure-chevron" size={22}/></summary>
    <div className="games-detail-disclosure-content">{children}</div>
  </details>;
}
