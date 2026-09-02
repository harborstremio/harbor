import { Download, Lock } from "lucide-react";
import { GitHubIcon } from "@/components/github-icon";
import cornerSvg from "@/assets/corner.svg";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const DOWNLOAD_URL = `${HARBOR_API_BASE}/download`;
const SOURCE_URL = "https://github.com/harborstremio/harbor";

export function WebBuildBanner() {
  const t = useT();
  return (
    <section className="relative overflow-hidden rounded-md bg-elevated p-7">
      <div className="group absolute -end-6 bottom-0 aspect-square h-[82%] cursor-default">
        <img
          src={cornerSvg}
          alt=""
          aria-hidden
          draggable={false}
          className="h-full w-full select-none transition-[filter] duration-[280ms] ease-out will-change-[filter] group-hover:blur-[7px] group-hover:brightness-[0.55]"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 scale-90 items-center justify-center rounded-md bg-canvas/45 text-ink opacity-0 backdrop-blur-md transition-[opacity,transform] duration-[280ms] ease-out group-hover:scale-100 group-hover:opacity-100">
            <Lock size={22} strokeWidth={2.1} />
          </span>
        </div>
      </div>
      <div className="relative z-10 flex max-w-[54%] flex-col gap-3">
        <span className="w-fit rounded-full bg-canvas px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {t("Web build")}
        </span>
        <h2 className="text-[19px] font-medium tracking-tight text-ink">
          {t("Where your data lives")}
        </h2>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {t(
            "Everything you save here stays in this browser. Your Stremio login, API keys, watch progress, picker cache, dismissed tips. Harbor servers never see any of it. Clearing your browser data wipes it.",
          )}
        </p>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {t(
            "The web build can't run mpv, the trickplay generator, the local bandwidth probe, or your own Cloudflare relay. If you want HDR passthrough, TrueHD or DTS-HD audio, and smoother seeking, grab the desktop app.",
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openUrl(DOWNLOAD_URL)}
            className="flex h-10 w-fit items-center gap-2 rounded-md bg-ink px-4 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
          >
            <Download size={14} strokeWidth={2.4} />
            {t("Get Harbor for desktop")}
          </button>
          <button
            type="button"
            onClick={() => openUrl(SOURCE_URL)}
            className="flex h-10 w-fit items-center gap-2 rounded-md bg-raised px-4 text-[13.5px] font-semibold text-ink transition-transform hover:scale-[1.02] active:scale-[0.97]"
          >
            <GitHubIcon size={14} strokeWidth={2.2} />
            {t("Source code")}
          </button>
        </div>
      </div>
    </section>
  );
}
