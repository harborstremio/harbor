import { useEffect, useRef, useState } from "react";

function LogoLayer({
  url,
  title,
  onReady,
  onFailed,
}: {
  url: string;
  title: string;
  onReady: () => void;
  onFailed: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const done = () => {
    setLoaded(true);
    onReady();
  };
  return (
    <img
      src={url}
      alt={title}
      decoding="async"
      ref={(el) => {
        if (el?.complete && el.naturalWidth > 0) done();
      }}
      onLoad={done}
      onError={onFailed}
      className={`absolute bottom-0 start-0 max-h-[124px] w-auto max-w-[440px] object-contain object-left rtl:object-right drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)] transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
    />
  );
}

export function TitlePlate({
  title,
  logo,
  loading,
}: {
  title: string;
  logo?: string;
  loading: boolean;
}) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const active = logo && !failed.has(logo) ? logo : undefined;
  const [layers, setLayers] = useState<{ id: number; url: string }[]>([]);
  const nextId = useRef(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setSettled(false);
    const timer = setTimeout(() => setSettled(true), 700);
    return () => clearTimeout(timer);
  }, [title]);

  useEffect(() => {
    if (!active) {
      setLayers((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const id = nextId.current++;
    setLayers((prev) =>
      prev[prev.length - 1]?.url === active ? prev : [...prev, { id, url: active }],
    );
  }, [active]);

  const settle = (id: number) =>
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      return idx > 0 ? prev.slice(idx) : prev;
    });

  const hasLogo = layers.length > 0;

  if (loading && !hasLogo) return <div className="min-h-[120px]" />;

  return (
    <div className="relative flex min-h-[120px] flex-col justify-end">
      <h1
        className={`font-display text-[80px] font-medium leading-[0.95] tracking-tight text-ink transition-opacity duration-500 ${!hasLogo && settled ? "opacity-100" : "opacity-0"}`}
      >
        {title}
      </h1>
      {layers.map((l) => (
        <LogoLayer
          key={l.id}
          url={l.url}
          title={title}
          onReady={() => settle(l.id)}
          onFailed={() => {
            setFailed((s) => new Set(s).add(l.url));
            setLayers((prev) => prev.filter((x) => x.id !== l.id));
          }}
        />
      ))}
    </div>
  );
}
