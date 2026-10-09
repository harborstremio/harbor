import { useT } from "@/lib/i18n";

export function AdSkipIcon({ className }: { className?: string }) {
  const t = useT();
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={t("Injected ad")}
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
      <path d="M8.3 14.4 L10 9.6 L11.7 14.4 M8.9 12.9 H11.1" strokeWidth={1.5} />
      <path d="M13.5 14.4 V9.6 H14.7 a2.1 2.1 0 0 1 0 4.2 H13.5" strokeWidth={1.5} />
    </svg>
  );
}
