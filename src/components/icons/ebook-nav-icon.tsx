import "./ebook-nav-icon.css";

export function EBookNavIcon({ active = false }: { active?: boolean }) {
  return (
    <span className={`ebook-nav-icon ${active ? "is-active" : ""}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none">
        <path className="ebook-nav-cover" d="M12 7v14" />
        <path
          className="ebook-nav-cover"
          d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
        />
        <path
          className="ebook-nav-page ebook-nav-page-one"
          d="M12.2 8.1c1.05-1.35 2.45-2.05 4.2-2.05h2.45v9.15h-2.7c-1.55 0-2.9.55-3.95 1.7"
        />
        <path
          className="ebook-nav-page ebook-nav-page-two"
          d="M12.2 9.55c.95-1.05 2.15-1.6 3.65-1.6h1.55v5.45h-1.75c-1.35 0-2.5.45-3.45 1.35"
        />
      </svg>
    </span>
  );
}
