import { Check, Copy, ExternalLink, QrCode } from "lucide-react";
import { useMemo, useState } from "react";
import { buildHandoffQr } from "@/lib/tv-handoff/handoff-qr";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { DeviceArt, type DeviceKind } from "./device-art";

function Qr({ url }: { url: string }) {
  const qr = useMemo(() => buildHandoffQr(url), [url]);
  if (!qr) return null;
  return (
    <svg
      viewBox={qr.viewBox}
      shapeRendering="crispEdges"
      className="h-full w-full"
      role="img"
      aria-hidden
    >
      <rect width={qr.extent} height={qr.extent} fill="#ffffff" />
      <path d={qr.path} fill="#000000" />
    </svg>
  );
}

function Action({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "done";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold transition-colors duration-150 active:scale-[0.98] ${
        tone === "done"
          ? "bg-success/15 text-success"
          : "bg-white/[0.06] text-ink hover:bg-white/[0.10]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function RemoteCard({
  kind,
  title,
  blurb,
  lanUrl,
  localUrl,
}: {
  kind: DeviceKind;
  title: string;
  blurb: string;
  lanUrl: string | null;
  localUrl: string;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const share = lanUrl ?? localUrl;

  const copy = () => {
    void navigator.clipboard.writeText(share).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-elevated p-5 ring-1 ring-edge-soft sm:flex-row sm:items-start">
      <div className="flex shrink-0 items-center gap-4">
        <span className="h-[70px] w-[70px] shrink-0 rounded-md bg-canvas/60 p-2.5 ring-1 ring-inset ring-edge-soft">
          <DeviceArt kind={kind} />
        </span>
        {lanUrl && (
          <span className="h-[70px] w-[70px] shrink-0 overflow-hidden rounded-md bg-white p-1.5">
            <Qr url={lanUrl} />
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-semibold text-ink">{title}</span>
          <span className="text-[12.5px] leading-relaxed text-ink-subtle">{blurb}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate rounded-md bg-canvas px-3 py-2 font-mono text-[12.5px] text-ink ring-1 ring-inset ring-edge-soft">
            {share}
          </span>
          <Action
            icon={copied ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={1.9} />}
            label={copied ? t("Copied") : t("Copy")}
            onClick={copy}
            tone={copied ? "done" : undefined}
          />
          <Action
            icon={<ExternalLink size={14} strokeWidth={1.9} />}
            label={t("Open here")}
            onClick={() => openUrl(localUrl)}
          />
        </div>

        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
          <QrCode size={12.5} strokeWidth={2} />
          {lanUrl
            ? t("Scan with your phone camera, or type the address above.")
            : t("No Wi-Fi address yet. Other devices cannot reach this computer.")}
        </span>
      </div>
    </div>
  );
}
