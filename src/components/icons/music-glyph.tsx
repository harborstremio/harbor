import playlistVariation from "@/assets/music-icons/playlist-variation.svg?raw";
import playlistRename from "@/assets/music-icons/playlist-rename.svg?raw";
import type { SVGProps } from "react";
import addToPlaylist from "@/assets/music-icons/add-to-playlist.svg?raw";
import album from "@/assets/music-icons/album.svg?raw";
import arrowDown from "@/assets/music-icons/arrow-down.svg?raw";
import arrowLeft from "@/assets/music-icons/arrow-left.svg?raw";
import arrowRight from "@/assets/music-icons/arrow-right.svg?raw";
import arrowUpRight from "@/assets/music-icons/arrow-up-right.svg?raw";
import artist from "@/assets/music-icons/artist.svg?raw";
import artistSimilar from "@/assets/music-icons/artist-similar.svg?raw";
import artistPlaybackOff from "@/assets/music-icons/artist-playback-off.svg?raw";
import artistPlaybackOn from "@/assets/music-icons/artist-playback-on.svg?raw";
import artistSongsHidden from "@/assets/music-icons/artist-songs-hidden.svg?raw";
import artistSongsVisible from "@/assets/music-icons/artist-songs-visible.svg?raw";
import audioSettings from "@/assets/music-icons/audio-settings.svg?raw";
import captions from "@/assets/music-icons/captions.svg?raw";
import captionsOff from "@/assets/music-icons/captions-off.svg?raw";
import check from "@/assets/music-icons/check.svg?raw";
import chevronLeft from "@/assets/music-icons/chevron-left.svg?raw";
import chevronRight from "@/assets/music-icons/chevron-right.svg?raw";
import clapperboard from "@/assets/music-icons/clapperboard.svg?raw";
import clock from "@/assets/music-icons/clock.svg?raw";
import close from "@/assets/music-icons/close.svg?raw";
import collapse from "@/assets/music-icons/collapse.svg?raw";
import copy from "@/assets/music-icons/copy.svg?raw";
import disconnect from "@/assets/music-icons/disconnect.svg?raw";
import download from "@/assets/music-icons/download.svg?raw";
import drive from "@/assets/music-icons/drive.svg?raw";
import exitFullscreen from "@/assets/music-icons/exit-fullscreen.svg?raw";
import expand from "@/assets/music-icons/expand.svg?raw";
import externalLink from "@/assets/music-icons/external-link.svg?raw";
import fileDownload from "@/assets/music-icons/file-download.svg?raw";
import fileUpload from "@/assets/music-icons/file-upload.svg?raw";
import film from "@/assets/music-icons/film.svg?raw";
import folderOpen from "@/assets/music-icons/folder-open.svg?raw";
import fullscreen from "@/assets/music-icons/fullscreen.svg?raw";
import globe from "@/assets/music-icons/globe.svg?raw";
import grip from "@/assets/music-icons/grip.svg?raw";
import heart from "@/assets/music-icons/heart.svg?raw";
import heartFilled from "@/assets/music-icons/heart-filled.svg?raw";
import imageDownload from "@/assets/music-icons/image-download.svg?raw";
import immersive from "@/assets/music-icons/immersive.svg?raw";
import info from "@/assets/music-icons/info.svg?raw";
import levels from "@/assets/music-icons/levels.svg?raw";
import library from "@/assets/music-icons/library.svg?raw";
import loading from "@/assets/music-icons/loading.svg?raw";
import lyrics from "@/assets/music-icons/lyrics.svg?raw";
import microphone from "@/assets/music-icons/microphone.svg?raw";
import miniPlayer from "@/assets/music-icons/mini-player.svg?raw";
import more from "@/assets/music-icons/more.svg?raw";
import music from "@/assets/music-icons/music.svg?raw";
import next from "@/assets/music-icons/next.svg?raw";
import palette from "@/assets/music-icons/palette.svg?raw";
import pause from "@/assets/music-icons/pause.svg?raw";
import play from "@/assets/music-icons/play.svg?raw";
import plus from "@/assets/music-icons/plus.svg?raw";
import previous from "@/assets/music-icons/previous.svg?raw";
import queue from "@/assets/music-icons/queue.svg?raw";
import queueNext from "@/assets/music-icons/queue-next.svg?raw";
import radio from "@/assets/music-icons/radio.svg?raw";
import refresh from "@/assets/music-icons/refresh.svg?raw";
import repeat from "@/assets/music-icons/repeat.svg?raw";
import repeatOne from "@/assets/music-icons/repeat-one.svg?raw";
import retry from "@/assets/music-icons/retry.svg?raw";
import search from "@/assets/music-icons/search.svg?raw";
import server from "@/assets/music-icons/server.svg?raw";
import shield from "@/assets/music-icons/shield.svg?raw";
import shirt from "@/assets/music-icons/shirt.svg?raw";
import shuffle from "@/assets/music-icons/shuffle.svg?raw";
import sortTitle from "@/assets/music-icons/sort-title.svg?raw";
import speaker from "@/assets/music-icons/speaker.svg?raw";
import store from "@/assets/music-icons/store.svg?raw";
import ticket from "@/assets/music-icons/ticket.svg?raw";
import trash from "@/assets/music-icons/trash.svg?raw";
import video from "@/assets/music-icons/video.svg?raw";
import videoOff from "@/assets/music-icons/video-off.svg?raw";
import volumeHigh from "@/assets/music-icons/volume-high.svg?raw";
import volumeLow from "@/assets/music-icons/volume-low.svg?raw";
import volumeMute from "@/assets/music-icons/volume-mute.svg?raw";
import warning from "@/assets/music-icons/warning.svg?raw";
import waveform from "@/assets/music-icons/waveform.svg?raw";

// Trusted Illustrator exports. Instance IDs are removed and ink follows the theme.
function prepare(raw: string): string {
  return raw
    .slice(raw.indexOf(">", raw.indexOf("<svg")) + 1, raw.lastIndexOf("</svg>"))
    .replace(/\sid="[^"]*"/g, "")
    .replace(/(fill|stroke)="#[0-9a-fA-F]{3,8}"/g, '$1="currentColor"');
}

const GLYPHS = {
  "add-to-playlist": prepare(addToPlaylist),
  "album": prepare(album),
  "arrow-down": prepare(arrowDown),
  "arrow-left": prepare(arrowLeft),
  "arrow-right": prepare(arrowRight),
  "arrow-up-right": prepare(arrowUpRight),
  "artist": prepare(artist),
  "artist-similar": prepare(artistSimilar),
  "artist-playback-off": prepare(artistPlaybackOff),
  "artist-playback-on": prepare(artistPlaybackOn),
  "artist-songs-hidden": prepare(artistSongsHidden),
  "artist-songs-visible": prepare(artistSongsVisible),
  "audio-settings": prepare(audioSettings),
  "captions": prepare(captions),
  "captions-off": prepare(captionsOff),
  "check": prepare(check),
  "chevron-left": prepare(chevronLeft),
  "chevron-right": prepare(chevronRight),
  "clapperboard": prepare(clapperboard),
  "clock": prepare(clock),
  "close": prepare(close),
  "collapse": prepare(collapse),
  "copy": prepare(copy),
  "disconnect": prepare(disconnect),
  "download": prepare(download),
  "drive": prepare(drive),
  "exit-fullscreen": prepare(exitFullscreen),
  "expand": prepare(expand),
  "external-link": prepare(externalLink),
  "file-download": prepare(fileDownload),
  "file-upload": prepare(fileUpload),
  "film": prepare(film),
  "folder-open": prepare(folderOpen),
  "fullscreen": prepare(fullscreen),
  "globe": prepare(globe),
  "grip": prepare(grip),
  "heart": prepare(heart),
  "heart-filled": prepare(heartFilled),
  "image-download": prepare(imageDownload),
  "immersive": prepare(immersive),
  "info": prepare(info),
  "levels": prepare(levels),
  "library": prepare(library),
  "loading": prepare(loading),
  "lyrics": prepare(lyrics),
  "microphone": prepare(microphone),
  "mini-player": prepare(miniPlayer),
  "more": prepare(more),
  "music": prepare(music),
  "next": prepare(next),
  "palette": prepare(palette),
  "pause": prepare(pause),
  "play": prepare(play),
  "plus": prepare(plus),
  "previous": prepare(previous),
  "playlist-variation": prepare(playlistVariation),
  "playlist-rename": prepare(playlistRename),
  "queue": prepare(queue),
  "queue-next": prepare(queueNext),
  "radio": prepare(radio),
  "refresh": prepare(refresh),
  "repeat": prepare(repeat),
  "repeat-one": prepare(repeatOne),
  "retry": prepare(retry),
  "search": prepare(search),
  "server": prepare(server),
  "shield": prepare(shield),
  "shirt": prepare(shirt),
  "shuffle": prepare(shuffle),
  "sort-title": prepare(sortTitle),
  "speaker": prepare(speaker),
  "store": prepare(store),
  "ticket": prepare(ticket),
  "trash": prepare(trash),
  "video": prepare(video),
  "video-off": prepare(videoOff),
  "volume-high": prepare(volumeHigh),
  "volume-low": prepare(volumeLow),
  "volume-mute": prepare(volumeMute),
  "warning": prepare(warning),
  "waveform": prepare(waveform),
} as const;

export type MusicGlyphName = keyof typeof GLYPHS;
export type MusicGlyphProps = Omit<SVGProps<SVGSVGElement>, "name" | "children"> & {
  name: MusicGlyphName;
  size?: number | string;
};

export function MusicGlyph({ name, size = 20, style, ...props }: MusicGlyphProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      {...props}
      style={{ flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: GLYPHS[name] }}
    />
  );
}
