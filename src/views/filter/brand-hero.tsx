import { useEffect, useState } from "react";
import { tmdbCompanyArt, type CompanyArt } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

const EMPTY: CompanyArt = { logo: null, backdrop: null, count: 0, span: "" };

export function useBrandArt(
  id: number,
  mediaType: "movie" | "tv",
  brand: "studio" | "network",
): CompanyArt {
  const { settings } = useSettings();
  const [art, setArt] = useState<CompanyArt>(EMPTY);
  useEffect(() => {
    setArt(EMPTY);
    if (!settings.tmdbKey || !id) return;
    let alive = true;
    void tmdbCompanyArt(settings.tmdbKey, id, mediaType, brand).then((a) => {
      if (alive) setArt(a);
    });
    return () => {
      alive = false;
    };
  }, [settings.tmdbKey, id, mediaType, brand]);
  return art;
}

export function BrandHero({
  art,
  kicker,
  title,
  subtitle,
  children,
}: {
  art: CompanyArt;
  kicker: string;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  const t = useT();
  const [lit, setLit] = useState(false);
  useEffect(() => {
    if (!art.backdrop) return;
    const img = new Image();
    img.onload = () => setLit(true);
    img.src = art.backdrop;
    return () => {
      img.onload = null;
    };
  }, [art.backdrop]);

  const facts = [
    art.count > 0 ? t("{n} titles", { n: art.count.toLocaleString() }) : "",
    art.span,
  ].filter(Boolean);

  return (
    <div className={`brand-hero ${art.backdrop ? "has-art" : ""}`}>
      {art.backdrop && (
        <div
          aria-hidden
          className="brand-hero-art"
          style={{ backgroundImage: `url(${art.backdrop})`, opacity: lit ? 1 : 0 }}
        />
      )}
      <div aria-hidden className="brand-hero-scrim" />
      <div aria-hidden className="brand-hero-side" />
      <div className="brand-hero-body">
        <span className="brand-hero-kicker">{kicker}</span>
        {art.logo ? (
          <img src={art.logo} alt={title} className="brand-hero-logo" draggable={false} />
        ) : (
          <h1 className="brand-hero-title">{title}</h1>
        )}
        {facts.length > 0 && (
          <span className="brand-hero-facts">{facts.join(" · ")}</span>
        )}
        <p className="brand-hero-sub">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
