import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info } from "lucide-react";
import { useT } from "@/lib/i18n";
import badge1080i from "@/assets/badges/1080i.png";
import badge1080p from "@/assets/badges/1080p_fhd.webp";
import badge2kQhd from "@/assets/badges/2k_qhd.png";
import badge360p240p from "@/assets/badges/360p_240p.png";
import badge480p from "@/assets/badges/480p.png";
import badge576pPal from "@/assets/badges/576p_pal.png";
import badge3d from "@/assets/badges/3d.webp";
import badge4kUhd from "@/assets/badges/4k_uhd.webp";
import badge51 from "@/assets/badges/5_1.webp";
import badge720p from "@/assets/badges/720p_hd.webp";
import badge71 from "@/assets/badges/7_1.webp";
import badge8k from "@/assets/badges/8k.png";
import badgeAac from "@/assets/badges/aac.png";
import badgeAc3 from "@/assets/badges/ac3.png";
import badgeAtmos from "@/assets/badges/atmos.webp";
import badgeAtmos912 from "@/assets/badges/atmos_912.png";
import badgeAv1 from "@/assets/badges/av1.png";
import badgeBluray from "@/assets/badges/bluray.png";
import badgeCam from "@/assets/badges/cam.png";
import badgeDd from "@/assets/badges/dd.png";
import badgeDdplus from "@/assets/badges/ddplus.png";
import badgeDolby from "@/assets/badges/dolby.webp";
import badgeDts from "@/assets/badges/dts.png";
import badgeDtsHd from "@/assets/badges/dtshd.webp";
import badgeDtsHdMa from "@/assets/badges/dtshd_ma.png";
import badgeDtsX from "@/assets/badges/dtsx.webp";
import badgeDv from "@/assets/badges/dv.webp";
import badgeDvb from "@/assets/badges/dvb.png";
import badgeDvd from "@/assets/badges/dvd.webp";
import badgeEac3 from "@/assets/badges/eac3.png";
import badgeExtended from "@/assets/badges/extended.png";
import badgeFlac from "@/assets/badges/flac.png";
import badgeHd from "@/assets/badges/hd.webp";
import badgeHdcam from "@/assets/badges/hdcam.png";
import badgeHdr from "@/assets/badges/hdr.webp";
import badgeHdr10 from "@/assets/badges/hdr10.png";
import badgeHdr10Plus from "@/assets/badges/hdr10plus.webp";
import badgeHdts from "@/assets/badges/hdts.png";
import badgeHdtv from "@/assets/badges/hdtv.png";
import badgeHevc from "@/assets/badges/hevc.png";
import badgeHlg from "@/assets/badges/hlg.png";
import badgeImax from "@/assets/badges/imax.png";
import badgeLpcm from "@/assets/badges/lpcm.png";
import badgeMono from "@/assets/badges/mono.png";
import badgeMp3 from "@/assets/badges/mp3.png";
import badgeNoLabel from "@/assets/badges/no_label.png";
import badgeOpus from "@/assets/badges/opus.png";
import badgePcm from "@/assets/badges/pcm.png";
import badgeRemastered from "@/assets/badges/remastered.png";
import badgeRemux from "@/assets/badges/remux.png";
import badgeRepack from "@/assets/badges/repack.png";
import badgeScr from "@/assets/badges/scr.png";
import badgeSd from "@/assets/badges/sd.png";
import badgeSdr from "@/assets/badges/sdr.png";
import badgeStereo from "@/assets/badges/stereo.webp";
import badgeTelecine from "@/assets/badges/telecine.png";
import badgeTelesync from "@/assets/badges/telesync.png";
import badgeTrueHd from "@/assets/badges/truehd.webp";
import badgeUhd from "@/assets/badges/uhd.png";
import badgeUnknown from "@/assets/badges/unknown.png";
import badgeWebdl from "@/assets/badges/webdl.png";
import badgeWebrip from "@/assets/badges/webrip.png";
import badgeWp from "@/assets/badges/wp.png";
import type { ParsedStream, ScoredStream } from "@/lib/streams/types";

export type BadgeKind =
  | "8k"
  | "4k-uhd"
  | "uhd"
  | "2k-qhd"
  | "1080p"
  | "1080i"
  | "720p"
  | "576p"
  | "480p"
  | "360p"
  | "hd"
  | "sd"
  | "dvd"
  | "3d"
  | "imax"
  | "bluray"
  | "remux"
  | "webdl"
  | "webrip"
  | "hdtv"
  | "dvb"
  | "hevc"
  | "av1"
  | "hdr"
  | "hdr10"
  | "hdr10-plus"
  | "dv"
  | "hlg"
  | "sdr"
  | "atmos"
  | "atmos-912"
  | "truehd"
  | "dts-hd"
  | "dts-hd-ma"
  | "dts-x"
  | "dts"
  | "dd"
  | "ddp"
  | "ac3"
  | "eac3"
  | "aac"
  | "flac"
  | "mp3"
  | "opus"
  | "pcm"
  | "lpcm"
  | "stereo"
  | "mono"
  | "5.1"
  | "7.1"
  | "cam"
  | "hdcam"
  | "telesync"
  | "hdts"
  | "telecine"
  | "scr"
  | "wp"
  | "extended"
  | "remastered"
  | "repack"
  | "no-label"
  | "unknown";

export type BadgeSize = "sm" | "md" | "lg";

const SRC: Record<BadgeKind, string> = {
  "8k": badge8k,
  "4k-uhd": badge4kUhd,
  uhd: badgeUhd,
  "2k-qhd": badge2kQhd,
  "1080p": badge1080p,
  "1080i": badge1080i,
  "720p": badge720p,
  "576p": badge576pPal,
  "480p": badge480p,
  "360p": badge360p240p,
  hd: badgeHd,
  sd: badgeSd,
  dvd: badgeDvd,
  "3d": badge3d,
  imax: badgeImax,
  bluray: badgeBluray,
  remux: badgeRemux,
  webdl: badgeWebdl,
  webrip: badgeWebrip,
  hdtv: badgeHdtv,
  dvb: badgeDvb,
  hevc: badgeHevc,
  av1: badgeAv1,
  hdr: badgeHdr,
  hdr10: badgeHdr10,
  "hdr10-plus": badgeHdr10Plus,
  dv: badgeDv,
  hlg: badgeHlg,
  sdr: badgeSdr,
  atmos: badgeAtmos,
  "atmos-912": badgeAtmos912,
  truehd: badgeTrueHd,
  "dts-hd": badgeDtsHd,
  "dts-hd-ma": badgeDtsHdMa,
  "dts-x": badgeDtsX,
  dts: badgeDts,
  dd: badgeDd,
  ddp: badgeDdplus,
  ac3: badgeAc3,
  eac3: badgeEac3,
  aac: badgeAac,
  flac: badgeFlac,
  mp3: badgeMp3,
  opus: badgeOpus,
  pcm: badgePcm,
  lpcm: badgeLpcm,
  stereo: badgeStereo,
  mono: badgeMono,
  "5.1": badge51,
  "7.1": badge71,
  cam: badgeCam,
  hdcam: badgeHdcam,
  telesync: badgeTelesync,
  hdts: badgeHdts,
  telecine: badgeTelecine,
  scr: badgeScr,
  wp: badgeWp,
  extended: badgeExtended,
  remastered: badgeRemastered,
  repack: badgeRepack,
  "no-label": badgeNoLabel,
  unknown: badgeUnknown,
};
void badgeDolby;

const ALT: Record<BadgeKind, string> = {
  "8k": "8K",
  "4k-uhd": "4K UHD",
  uhd: "UHD",
  "2k-qhd": "2K QHD",
  "1080p": "1080p Full HD",
  "1080i": "1080i",
  "720p": "720p HD",
  "576p": "576p PAL",
  "480p": "480p",
  "360p": "360p / 240p",
  hd: "HD",
  sd: "Standard Definition",
  dvd: "DVD",
  "3d": "3D",
  imax: "IMAX",
  bluray: "Blu-ray",
  remux: "REMUX",
  webdl: "WEB-DL",
  webrip: "WEBRip",
  hdtv: "HDTV",
  dvb: "DVB",
  hevc: "HEVC / x265",
  av1: "AV1",
  hdr: "HDR",
  hdr10: "HDR10",
  "hdr10-plus": "HDR10+",
  dv: "Dolby Vision",
  hlg: "HLG",
  sdr: "SDR",
  atmos: "Dolby Atmos",
  "atmos-912": "Dolby Atmos 9.1.2",
  truehd: "Dolby TrueHD",
  "dts-hd": "DTS-HD",
  "dts-hd-ma": "DTS-HD MA",
  "dts-x": "DTS:X",
  dts: "DTS",
  dd: "Dolby Digital",
  ddp: "Dolby Digital Plus",
  ac3: "AC3",
  eac3: "EAC3",
  aac: "AAC",
  flac: "FLAC",
  mp3: "MP3",
  opus: "Opus",
  pcm: "PCM",
  lpcm: "LPCM",
  stereo: "Stereo",
  mono: "Mono",
  "5.1": "5.1",
  "7.1": "7.1",
  cam: "Cam",
  hdcam: "HD Cam",
  telesync: "Telesync",
  hdts: "HD Telesync",
  telecine: "Telecine",
  scr: "Screener",
  wp: "Workprint",
  extended: "Extended Cut",
  remastered: "Remastered",
  repack: "Repack",
  "no-label": "No quality label",
  unknown: "Quality unverified",
};

const WIDTH: Record<BadgeSize, number> = {
  sm: 30,
  md: 42,
  lg: 60,
};
const MAX_HEIGHT: Record<BadgeSize, number> = {
  sm: 28,
  md: 40,
  lg: 56,
};
// New-pack badges ship as 1248×1248 (square) with transparent padding around
// the artwork. At the landscape footprint they read tiny next to the legacy
// pack. Multiplier scales these specific kinds up so the inner art matches
// the visual weight of the older landscape badges. Legacy kinds keep the
// stock dimensions.
const SCALE_UP: Partial<Record<BadgeKind, number>> = {
  "1080i": 1.5,
  "2k-qhd": 1.5,
  "360p": 1.5,
  "576p": 1.5,
  uhd: 1.5,
  webrip: 1.5,
  hdtv: 1,
  dvb: 1.5,
  hdcam: 1.5,
  hdts: 1.5,
  scr: 1.5,
  wp: 1.5,
  hdr10: 1.5,
  sdr: 1.5,
  "atmos-912": 1.5,
  "dts-hd-ma": 1.5,
  dd: 1.5,
  ddp: 1.5,
  ac3: 1.5,
  eac3: 1.5,
  mp3: 1.5,
  opus: 1.5,
  pcm: 1.5,
  lpcm: 1.5,
  extended: 1.5,
  remastered: 1.5,
  repack: 1.5,
};

type QualityNote = { title: string; body: string; tone: "warn" | "info" };

const QUALITY_NOTES: Partial<Record<BadgeKind, QualityNote>> = {
  cam: {
    title: "Camcorder rip",
    body: "Filmed in a theater with a handheld camera. Picture is shaky, faces look soft, you'll hear the crowd. Watch only if you can't wait. Quality is rough.",
    tone: "warn",
  },
  telesync: {
    title: "Telesync rip",
    body: "Cam-quality picture with audio plugged into the projector or a separate recorder. Sound is clean, but the image is still a theater capture. Better than CAM, far below a real release.",
    tone: "warn",
  },
  telecine: {
    title: "Telecine",
    body: "Captured directly from a film reel via a telecine machine. Picture is solid but colors can drift, and these are rare. Treat it as a stand-in until the official release lands.",
    tone: "info",
  },
  "no-label": {
    title: "No quality label",
    body: "The addon didn't tell us anything about this file's resolution or source. It could be anything from 4K Blu-ray to a phone capture. Pick a labeled stream if one exists.",
    tone: "warn",
  },
  unknown: {
    title: "Quality unverified",
    body: "The label looks high (1080p / 4K) but doesn't match expected file size or release window. Often a CAM or TS rebadged. Try a Theater Capture stream or check the source list before committing.",
    tone: "warn",
  },
};

export function FormatBadge({ kind, size = "md" }: { kind: BadgeKind; size?: BadgeSize }) {
  const note = QUALITY_NOTES[kind];
  const scale = SCALE_UP[kind] ?? 1;
  const w = Math.round(WIDTH[size] * scale);
  const maxH = Math.round(MAX_HEIGHT[size] * scale);
  const imgEl = (
    <img
      src={SRC[kind]}
      alt={ALT[kind]}
      style={{
        width: w,
        height: "auto",
        maxHeight: maxH,
        objectFit: "contain",
        display: "inline-block",
        userSelect: "none",
        pointerEvents: "none",
        flexShrink: 0,
      }}
      draggable={false}
    />
  );
  if (!note) return imgEl;
  return <BadgeWithTooltip note={note}>{imgEl}</BadgeWithTooltip>;
}

const TOOLTIP_WIDTH = 280;
const TOOLTIP_GAP = 8;

function BadgeWithTooltip({ note, children }: { note: QualityNote; children: React.ReactNode }) {
  const t = useT();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; place: "above" | "below" } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const desiredHeight = 120;
    const place: "above" | "below" =
      rect.top - desiredHeight - TOOLTIP_GAP > 12 ? "above" : "below";
    const top =
      place === "above" ? rect.top - TOOLTIP_GAP - desiredHeight : rect.bottom + TOOLTIP_GAP;
    let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    left = Math.max(12, Math.min(left, vw - TOOLTIP_WIDTH - 12));
    setPos({ top, left, place });
    void vh;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  const accent = note.tone === "warn" ? "text-danger" : "text-accent";

  return (
    <span
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      className="relative inline-flex shrink-0 items-center cursor-help outline-none"
    >
      {children}
      {open &&
        pos &&
        createPortal(
          <div
            style={{
              top: pos.top,
              left: pos.left,
              width: TOOLTIP_WIDTH,
              background:
                "linear-gradient(var(--color-elevated), var(--color-elevated)), var(--color-canvas)",
            }}
            className="pointer-events-none fixed z-[145] flex flex-col gap-1.5 rounded-xl border border-edge px-3.5 py-3 text-start shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
          >
            <span
              className={`flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] ${accent}`}
            >
              {note.tone === "warn" ? (
                <AlertTriangle size={11} strokeWidth={2.4} />
              ) : (
                <Info size={11} strokeWidth={2.4} />
              )}
              {t(note.title)}
            </span>
            <p className="text-[12.5px] leading-snug text-ink-muted">{t(note.body)}</p>
          </div>,
          document.body,
        )}
    </span>
  );
}

export function resolutionBadge(s: ParsedStream): BadgeKind | null {
  if (s.resolution === "4K") return "4k-uhd";
  if (s.resolution === "1080p") return "1080p";
  if (s.resolution === "720p") return "720p";
  if (s.resolution === "480p") {
    if (s.source === "DVDRip") return "dvd";
    return "480p";
  }
  if (s.resolution === "SD") {
    if (s.source === "DVDRip") return "dvd";
    return "sd";
  }
  return null;
}

export type QualityConfidence = "labeled" | "unverified" | "unlabeled";

export function qualityConfidence(s: ParsedStream | ScoredStream): QualityConfidence {
  const nothingDetected =
    s.resolution === "SD" &&
    s.source === "Other" &&
    s.codec === "Other" &&
    !s.hdrFormat &&
    s.audio.codec === "Other";
  if (nothingDetected) return "unlabeled";
  const reasons = "reasons" in s ? s.reasons : null;
  const flagged = reasons?.some(
    (r) =>
      r.signal.startsWith("fresh-fake-") ||
      r.signal === "fresh-soft-flag" ||
      r.signal === "fresh-prerelease-soft" ||
      r.signal === "fresh-prebluray-suspect" ||
      r.signal === "size-mismatch" ||
      r.signal === "title-says-hires-filename-says-cam",
  );
  if (flagged) return "unverified";
  const claimsHighRes = s.resolution === "4K" || s.resolution === "1080p";
  const directStream = !!s.url && !s.infoHash;
  if (claimsHighRes && s.size == null && s.source === "Other" && !directStream) return "unverified";
  return "labeled";
}

export function hdrBadge(s: ParsedStream): BadgeKind | null {
  if (!s.hdrFormat) return null;
  if (s.hdrFormat === "DV" || s.hdrFormat === "DV+HDR10") return "dv";
  if (s.hdrFormat === "HDR10+") return "hdr10-plus";
  if (s.hdrFormat === "HDR10") return "hdr10";
  if (s.hdrFormat === "HLG") return "hlg";
  return null;
}

export function audioBadge(s: ParsedStream): BadgeKind | null {
  if (s.audio.codec === "Atmos") return "atmos";
  if (s.audio.codec === "TrueHD") return "truehd";
  if (s.audio.codec === "DTS-HD MA") return "dts-hd";
  if (s.audio.codec === "DTS") return "dts";
  if (s.audio.codec === "DD+") return "ddp";
  if (s.audio.codec === "FLAC") return "flac";
  if (s.audio.codec === "AAC") return "aac";
  if (s.audio.channels === 1) return "mono";
  return null;
}

export function sourceBadge(s: ParsedStream): BadgeKind | null {
  if (s.source === "CAM") return "cam";
  if (s.source === "TS" || s.source === "HDTS") return "telesync";
  if (s.source === "TC") return "telecine";
  return null;
}

export function releaseSourceBadge(s: ParsedStream): BadgeKind | null {
  if (s.remux) return "remux";
  if (s.source === "BluRay" || s.source === "BDRip") return "bluray";
  if (s.source === "WEB-DL" || s.source === "WEBRip" || s.source === "HDRip") return "webdl";
  if (s.source === "HDTV") return "hdtv";
  return null;
}

export function codecBadge(s: ParsedStream): BadgeKind | null {
  if (s.codec === "HEVC") return "hevc";
  if (s.codec === "AV1") return "av1";
  return null;
}

export function streamBadges(s: ParsedStream | ScoredStream): BadgeKind[] {
  const out: BadgeKind[] = [];
  const src = sourceBadge(s);
  const confidence = qualityConfidence(s);
  if (src) {
    out.push(src);
  } else if (confidence === "unlabeled") {
    out.push("no-label");
  } else if (confidence === "unverified") {
    out.push("unknown");
  } else {
    const r = resolutionBadge(s);
    if (r) out.push(r);
  }
  const release = releaseSourceBadge(s);
  if (release && !src) out.push(release);
  const c = codecBadge(s);
  if (c) out.push(c);
  const h = hdrBadge(s);
  if (h) out.push(h);
  const a = audioBadge(s);
  if (a) out.push(a);
  return out;
}
