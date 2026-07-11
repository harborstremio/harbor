import type { CastDeviceInfo } from "@/lib/cast";
import { Monitor, Tv2 } from "lucide-react";
import { useState } from "react";

const MODULES = import.meta.glob("/src/assets/cast-icons/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const ICONS: Record<string, string> = {};
for (const [path, url] of Object.entries(MODULES)) {
  const m = path.match(/([^/]+)\.webp$/);
  if (m) ICONS[m[1]] = url;
}

const icon = (slug: string): string | null => ICONS[slug] ?? null;

const NAME_RULES: Array<[RegExp, string]> = [
  [/google tv|chromecast with google tv|gtv/, "google_tv_streamer"],
  [/nest hub|google home hub|home hub|nest audio|google nest/, "google_nest_hub"],
  [/chromecast|eureka|\bcast\b/, "chromecast"],
  [/homepod/, "naim_mu_so"],
  [/apple tv|appletv/, "apple_tv_4k"],
  [/fire tv cube|fire cube/, "amazon_fire_tv_cube"],
  [/insignia.*fire|toshiba.*fire/, "toshiba_fire_tv"],
  [/fire ?stick|fire tv stick|fire tv\b|aftt|aftm|aftr|afts/, "firestick"],
  [/echo show|echo15|echo spot/, "amazon_echo_show"],
  [/nvidia|shield/, "nvidia_shield_tv"],
  [/tivo/, "tivo_stream_4k"],
  [/tcl.*google|google.*tcl/, "tcl_google_tv"],
  [/tcl.*roku/, "tcl_roku_tv"],
  [/hisense.*roku/, "hisense_roku_tv"],
  [/hisense|vidaa/, "hisense_vidda_tv"],
  [/\b\d{2,3}u[6-9][a-z]?\b/, "hisense_vidda_tv"],
  [/\b\d{2,3}(?:r6\d{2}|q[78]\d{2}|s4\d{2}|c8\d{2})/, "tcl_google_tv"],
  [/\broku\b.*ultra|ultra.*roku/, "roku_ultra"],
  [/roku.*stick|streaming stick/, "roku_streaming_stick_4k"],
  [/roku tv|\broku\b/, "roku_tv"],
  [/samsung|tizen/, "samsung_smart_tv"],
  [/\b(?:qn|un|gq|ue|qe|ks|ku|mu|ju|hu|eh|tu|au|bu|cu|du|ls)\d{2,3}[a-z]/, "samsung_smart_tv"],
  [/\blg\b|webos|lg electronics|thinq/, "lg_oled_tv"],
  [/\boled\d{2,3}|\bnano\d{2,3}|\bqned\d{2,3}|\b(?:ur|uq|up|um)\d{2,3}/, "lg_oled_tv"],
  [/sony.*android|android.*sony/, "sony_android_tv"],
  [/sony|bravia/, "sony_bravia_tv"],
  [/\b(?:kd|xbr|xr|kj)-?\d{2,3}/, "sony_bravia_tv"],
  [/philips|saphi/, "philips_saphi_tv"],
  [/panasonic|viera/, "panasonic_viera_tv"],
  [/vizio.*elevate/, "vizio_elevate_soundbar"],
  [/vizio|smartcast/, "vizio_smartcast_tv"],
  [/sharp|aquos/, "sharp_aquos_tv"],
  [/skyworth/, "skyworth_android_tv"],
  [/sonos.*arc/, "sonos_arc_soundbar"],
  [/sonos.*beam/, "sonos_beam"],
  [/sonos.*era/, "sonos_era_300"],
  [/sonos.*move|sonos.*roam/, "sonos_move"],
  [/sonos.*play:?5|play:5/, "sonos_play_5"],
  [/sonos.*play:?3|play:3/, "sonos_play_3"],
  [/sonos|playbar|play:1/, "sonos_beam"],
  [/bose/, "bose_smart_speaker"],
  [/denon/, "denon_av_receiver"],
  [/marantz/, "marantz_receiver"],
  [/onkyo/, "onkyo_tx_receiver"],
  [/pioneer/, "pioneer_elite_receiver"],
  [/heos/, "heos_link_preamp"],
  [/yamaha|musiccast/, "yamaha_musiccast_speaker"],
  [/bluesound|bluesound node/, "bluesound_node"],
  [/bang.*olufsen|b&o|beosound/, "bang_olufsen_beosound"],
  [/devialet|phantom/, "devialet_phantom"],
  [/\bkef\b|ls50/, "kef_ls50_wireless"],
  [/klipsch/, "klipsch_the_fives_speakers"],
  [/marshall/, "marshall_stanmore_speaker"],
  [/\bnaim\b|mu-?so/, "naim_mu_so"],
  [/\bjbl\b/, "jbl_authentics_speaker"],
  [/bowers|wilkins|b&w|zeppelin/, "bowers_wilkins_zeppelin"],
  [/cambridge audio/, "cambridge_audio_streamer"],
  [/audiolab/, "audiolab_streamer"],
  [/playstation|\bps5\b/, "playstation_5"],
  [/xbox/, "xbox_series_x"],
  [/nintendo|switch/, "nintendo_switch"],
  [/epson|projector|beamer/, "epson_projector"],
  [/anycast/, "anycast_dongle"],
  [/microsoft wireless display|miracast/, "microsoft_wireless_display_v2"],
  [/wireless display|display adapter|ezcast/, "wireless_display_adapter"],
  [/hdmi dongle|hdmi stick/, "generic_hdmi_dongle"],
  [/android tv|android box|mi box|mibox/, "android_tv_box"],
  [/ipad/, "ipad_pro"],
  [/iphone/, "iphone_15"],
  [/android.*phone|pixel|galaxy s\d/, "android_phone_generic"],
  [/soundbar|sound bar/, "sonos_arc_soundbar"],
  [/receiver|\bavr\b|amplifier/, "denon_av_receiver"],
  [/speaker|wireless audio|airplay audio/, "bose_smart_speaker"],
];

const KIND_FALLBACK: Record<string, string> = {
  chromecast: "chromecast",
  roku: "roku_ultra",
  airplay: "apple_tv_4k",
  dlna: "generic_set_top_box",
};

const DARK_ICONS = new Set(["marantz_receiver"]);

function resolveSlug(device: CastDeviceInfo): string | null {
  const hay = `${device.name} ${device.model ?? ""}`.toLowerCase();
  for (const [re, slug] of NAME_RULES) {
    if (re.test(hay) && icon(slug)) return slug;
  }
  const fallback = KIND_FALLBACK[device.kind] ?? "generic_streaming_stick";
  return icon(fallback) ? fallback : null;
}

export function CastIcon({ device, size = 28 }: { device: CastDeviceInfo; size?: number }) {
  const [errored, setErrored] = useState(false);
  const slug = resolveSlug(device);
  const src = slug ? icon(slug) : null;
  if (!src || errored) {
    return device.kind === "dlna" ? (
      <Tv2 size={Math.round(size * 0.55)} strokeWidth={1.8} className="text-ink-muted" />
    ) : (
      <Monitor size={Math.round(size * 0.55)} strokeWidth={1.8} className="text-ink-muted" />
    );
  }
  const isDark = slug != null && DARK_ICONS.has(slug);
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className={`h-full w-full object-contain ${isDark ? "opacity-100" : "opacity-90"}`}
      style={isDark ? { filter: "brightness(1.6) contrast(1.05)" } : undefined}
    />
  );
}
