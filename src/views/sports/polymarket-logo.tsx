import logo from "@/assets/service-logos/polymarket.svg";

export function PolymarketLogo({ decorative = false }: { decorative?: boolean }) {
  return (
    <span
      className="sh-market-brand"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Polymarket"}
      aria-hidden={decorative || undefined}
      style={{ maskImage: `url(${logo})` }}
    />
  );
}
