import { useEffect, useState } from "react";
import { QR_DARK, QR_LIGHT } from "@/lib/tv-handoff/handoff-qr";
import QRCode from "qrcode";
import { Smartphone, X } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { SFX } from "@/lib/sfx";
import { useBpT } from "./bp-i18n";
import { bpPlatform } from "./bp-platform";

const WEB_PORT = 11471;

// [data-bp-row] carries the page gutter as padding plus a matching negative
// margin, which would push the header outside the dialog panel.
const HEADER_SCOPE = { paddingInline: 0, marginInline: 0, containIntrinsicSize: "auto 76px" } as const;

export function BpPhoneTyping({ onClose }: { onClose: () => void }) {
  const t = useBpT();
  const { settings, update } = useSettings();
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [png, setPng] = useState<string | null>(null);

  const serving = settings.serveWebUi || settings.remoteControlEnabled;
  const url = lanIp ? `http://${lanIp}:${WEB_PORT}/remote` : null;

  useEffect(() => {
    let alive = true;
    void bpPlatform()
      .lanAddress()
      .then((ip) => {
        if (alive) setLanIp(ip);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    void QRCode.toDataURL(url, {
      margin: 1,
      width: 520,
      errorCorrectionLevel: "M",
      color: { dark: QR_DARK, light: QR_LIGHT },
    })
      .then((data) => {
        if (alive) setPng(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div
      data-bp-dialog
      className="absolute inset-0 z-50 flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_82%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div className="flex w-[min(88vw,620px)] flex-col gap-[clamp(14px,1.9vh,26px)] rounded-[var(--bp-r-lg)] bg-[var(--bp-panel)] p-[clamp(22px,2.6vw,42px)]">
        <div data-bp-row style={HEADER_SCOPE}>
        <div data-bp-scroll-x className="flex items-center gap-3">
          <Smartphone size={22} strokeWidth={2.1} className="shrink-0 text-ink-muted" />
          <h2 className="flex-1 font-display text-[clamp(19px,2.7vh,32px)] font-semibold text-ink">
            {t("Type on your phone")}
          </h2>
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            data-bp-autofocus="true"
            onClick={() => {
              SFX.close();
              onClose();
            }}
            aria-label={t("Close")}
            className="flex h-[clamp(44px,4.4vh,50px)] w-[clamp(44px,4.4vh,50px)] shrink-0 items-center justify-center rounded-full border border-[var(--bp-edge)] text-ink-muted"
          >
            <X size={18} strokeWidth={2.3} />
          </button>
        </div>
        </div>

        {!serving ? (
          <>
            <p className="text-[clamp(13px,1.8vh,20px)] leading-relaxed text-ink-subtle">
              {t("Harbor needs to be serving on your network before a phone can reach it.")}
            </p>
            <button
              type="button"
              data-bp-focusable
              data-bp-chip
              onClick={() => {
                SFX.click();
                update({ serveWebUi: true, remoteControlEnabled: true });
              }}
              className="h-[clamp(46px,5.4vh,62px)] rounded-full bg-[var(--bp-on)] px-[clamp(20px,1.8vw,34px)] text-[clamp(13.5px,1.9vh,21px)] font-bold text-ink"
            >
              {t("Turn on network serving")}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-[clamp(16px,2vw,32px)]">
              <div className="shrink-0 overflow-hidden rounded-[var(--bp-r-md)] bg-white p-[clamp(8px,0.8vw,14px)]">
                {png ? (
                  <img
                    src={png}
                    alt={t("QR code")}
                    className="h-[clamp(150px,20vh,236px)] w-[clamp(150px,20vh,236px)]"
                  />
                ) : (
                  <div className="h-[clamp(150px,20vh,236px)] w-[clamp(150px,20vh,236px)] animate-pulse bg-[var(--bp-panel-2)] motion-reduce:animate-none" />
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-[clamp(7px,1vh,14px)]">
                <p className="text-[clamp(13px,1.8vh,20px)] leading-relaxed text-ink-subtle">
                  {t("Scan this with your phone camera to open the Harbor remote, then type straight into the search box.")}
                </p>
                <p className="text-[clamp(11.5px,1.6vh,17px)] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                  {t("Same Wi-Fi as this computer")}
                </p>
                {url && (
                  <code className="truncate rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)] px-3 py-2 text-[clamp(12px,1.6vh,18px)] font-semibold text-ink">
                    {url}
                  </code>
                )}
              </div>
            </div>
            {!lanIp && (
              <p className="text-[clamp(12.5px,1.7vh,19px)] text-danger">
                {t("Couldn't find this computer's Wi-Fi address.")}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
