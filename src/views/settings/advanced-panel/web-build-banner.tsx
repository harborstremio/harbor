import { Download, Lock } from "../icons";
import { GitHubIcon } from "@/components/github-icon";
import cornerSvg from "@/assets/corner.svg";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import { ROW_DESC } from "../shared";

const DOWNLOAD_URL = `${HARBOR_API_BASE}/download`;
const SOURCE_URL = "https://github.com/harborstremio/harbor";

const BANNER_BTN =
  "flex h-11 w-fit items-center gap-2 rounded-[8px] px-4 text-[15px] font-semibold transition-transform hover:scale-[1.02] active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function WebBuildBanner() {
  const t = useT();
  return (
    <section className="relative overflow-hidden rounded-[10px] bg-elevated p-7">
      <div className="group absolute -end-6 bottom-0 aspect-square h-[82%] cursor-default">
        <img
          src={cornerSvg}
          alt=""
          aria-hidden
          draggable={false}
          className="h-full w-full select-none transition-[filter] duration-[280ms] ease-out will-change-[filter] group-hover:blur-[7px] group-hover:brightness-[0.55]"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 scale-90 items-center justify-center rounded-[10px] bg-canvas/45 text-ink opacity-0 backdrop-blur-md transition-[opacity,transform] duration-[280ms] ease-out group-hover:scale-100 group-hover:opacity-100">
            <Lock size={22} strokeWidth={2.1} />
          </span>
        </div>
      </div>
      <div className="relative z-10 flex max-w-[58%] flex-col gap-3">
        <span className="w-fit rounded-[6px] bg-canvas px-2 py-[3px] text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-ink-subtle">
          {t("Web build")}
        </span>
        <h2 className="text-[19px] font-medium tracking-tight text-ink">
          {t("Where your data lives")}
        </h2>
        <p className={`max-w-[66ch] ${ROW_DESC}`}>
          {t(
            "Everything you save here stays in this browser. Your Stremio login, API keys, watch progress, picker cache, dismissed tips. Harbor servers never see any of it. Clearing your browser data wipes it.",
          )}
        </p>
        <p className={`max-w-[66ch] ${ROW_DESC}`}>
          {t(
            "The web build can't run mpv, the trickplay generator, the local bandwidth probe, or your own Cloudflare relay. If you want HDR passthrough, TrueHD or DTS-HD audio, and smoother seeking, grab the desktop app.",
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openUrl(DOWNLOAD_URL)}
            className={`${BANNER_BTN} bg-ink text-canvas`}
          >
            <Download size={16} strokeWidth={2.4} />
            {t("Get Harbor for desktop")}
          </button>
          <button
            type="button"
            onClick={() => openUrl(SOURCE_URL)}
            className={`${BANNER_BTN} bg-raised text-ink`}
          >
            <GitHubIcon size={16} strokeWidth={2.2} />
            {t("Source code")}
          </button>
        </div>
      </div>
    </section>
  );
}
