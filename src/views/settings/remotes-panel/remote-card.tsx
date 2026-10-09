import { Check, Copy, ExternalLink } from "../icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { QR_DARK, QR_LIGHT, buildHandoffQr } from "@/lib/tv-handoff/handoff-qr";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { Section } from "../shared";
import { SButton } from "../ui";
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
      <rect width={qr.extent} height={qr.extent} rx={1.5} fill={QR_LIGHT} />
      <path d={qr.path} fill={QR_DARK} />
    </svg>
  );
}

export function RemoteCard({
  kind,
  title,
  blurb,
  lanUrl,
  localUrl,
  probed,
}: {
  kind: DeviceKind;
  title: string;
  blurb: string;
  lanUrl: string | null;
  localUrl: string;
  probed: boolean;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const share = lanUrl ?? localUrl;
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const copy = () => {
    setCopyFailed(false);
    void navigator.clipboard.writeText(share).then(() => {
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    }).catch(() => setCopyFailed(true));
  };

  return (
    <Section title={title} subtitle={blurb}>
        <div className="flex w-full flex-wrap items-start gap-5">
          <div className="flex shrink-0 items-center gap-3">
            <span className="block h-[80px] w-[80px] shrink-0">
              <DeviceArt kind={kind} />
            </span>
            {lanUrl && (
              <span className="block h-[132px] w-[132px] shrink-0 rounded-[6px] border border-edge-soft">
                <Qr url={lanUrl} />
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 basis-[300px] flex-col gap-2.5">
            <span
              dir="ltr"
              className="flex min-h-11 w-full max-w-[520px] items-center rounded-[10px] border border-edge-soft bg-elevated px-4 py-2.5 font-mono text-[16.5px] leading-[22px] text-ink [overflow-wrap:anywhere]"
            >
              {share}
            </span>

            <div className="flex flex-wrap items-center gap-2.5">
              <SButton onClick={copy}>
                {copied ? (
                  <Check size={18} strokeWidth={2.6} className="text-success" />
                ) : (
                  <Copy size={18} strokeWidth={1.9} />
                )}
                {copied ? t("Copied") : lanUrl ? t("Copy address") : t("Copy local address")}
              </SButton>
              <SButton onClick={() => openUrl(localUrl)}>
                <ExternalLink size={18} strokeWidth={1.9} />
                {t("Open here")}
              </SButton>
            </div>

            {lanUrl && (
              <p className="max-w-[66ch] text-[15.5px] font-normal leading-[22px] text-ink-muted">
                {t("Scan with your phone camera, or type the address above.")}
              </p>
            )}
            {probed && !lanUrl && <p className="text-[15px] leading-[22px] text-ink-muted">
              {t("Local address for this computer. Connect to a local network to get an address for your other devices.")}
            </p>}
            {copyFailed && <p role="alert" className="text-[15px] leading-[22px] text-danger">
              {t("Couldn't copy the address. Select it above and copy it manually.")}
            </p>}
          </div>
        </div>
    </Section>
  );
}
