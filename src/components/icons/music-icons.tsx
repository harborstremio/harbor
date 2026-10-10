import type { ComponentType } from "react";
import { MusicGlyph, type MusicGlyphName, type MusicGlyphProps } from "./music-glyph";

export type MusicIconProps = Omit<MusicGlyphProps, "name">;
export type MusicIconComponent = ComponentType<MusicIconProps>;

// Keep the music screens' component interface stable; all paths are local masters.
function icon(name: MusicGlyphName): MusicIconComponent {
  function Icon({ size = 24, fill, ...props }: MusicIconProps) {
    const glyph = name === "heart" && fill && fill !== "none" ? "heart-filled" : name;
    return <MusicGlyph name={glyph} size={size} {...props} />;
  }
  Icon.displayName = `MusicIcon(${name})`;
  return Icon;
}

export const ArrowDown = icon("arrow-down");
export const ArrowDownAZ = icon("sort-title");
export const ArrowLeft = icon("arrow-left");
export const ArrowRight = icon("arrow-right");
export const ArrowUpRight = icon("arrow-up-right");
export const AudioLines = icon("waveform");
export const BarChart3 = icon("levels");
export const Captions = icon("captions");
export const CaptionsOff = icon("captions-off");
export const Check = icon("check");
export const ChevronDown = icon("collapse");
export const ChevronLeft = icon("chevron-left");
export const ChevronRight = icon("chevron-right");
export const ChevronUp = icon("expand");
export const Clapperboard = icon("clapperboard");
export const Clock3 = icon("clock");
export const Copy = icon("copy");
export const Disc3 = icon("album");
export const Download = icon("download");
export const ExternalLink = icon("external-link");
export const FileDown = icon("file-download");
export const FileUp = icon("file-upload");
export const Film = icon("film");
export const FolderOpen = icon("folder-open");
export const Globe2 = icon("globe");
export const GripVertical = icon("grip");
export const HardDrive = icon("drive");
export const Heart = icon("heart");
export const ImageDown = icon("image-download");
export const Info = icon("info");
export const Library = icon("library");
export const ListMusic = icon("queue");
export const ListPlus = icon("add-to-playlist");
export const ListStart = icon("queue-next");
export const Loader2 = icon("loading");
export const LoaderCircle = icon("loading");
export const Maximize = icon("fullscreen");
export const Mic2 = icon("microphone");
export const MicVocal = icon("microphone");
export const Minimize = icon("exit-fullscreen");
export const MoreHorizontal = icon("more");
export const Music2 = icon("music");
export const Palette = icon("palette");
export const Pause = icon("pause");
export const Play = icon("play");
export const Plus = icon("plus");
export const Radio = icon("radio");
export const RefreshCw = icon("refresh");
export const RotateCcw = icon("retry");
export const Save = icon("download");
export const Search = icon("search");
export const Server = icon("server");
export const ShieldCheck = icon("shield");
export const Shirt = icon("shirt");
export const ShoppingBag = icon("store");
export const Shuffle = icon("shuffle");
export const SkipBack = icon("previous");
export const SkipForward = icon("next");
export const SlidersHorizontal = icon("audio-settings");
export const Speaker = icon("speaker");
export const Ticket = icon("ticket");
export const Trash2 = icon("trash");
export const TriangleAlert = icon("warning");
export const Unplug = icon("disconnect");
export const UserRound = icon("artist");
export const Video = icon("video");
export const VideoOff = icon("video-off");
export const Volume2 = icon("volume-high");
export const Wallpaper = icon("immersive");
export const X = icon("close");

export const PlaylistVariation = icon("playlist-variation");
export const PlaylistRename = icon("playlist-rename");
export const ArtistSimilar = icon("artist-similar");
export const ArtistPlaybackOff = icon("artist-playback-off");
export const ArtistPlaybackOn = icon("artist-playback-on");
export const ArtistSongsHidden = icon("artist-songs-hidden");
export const ArtistSongsVisible = icon("artist-songs-visible");
