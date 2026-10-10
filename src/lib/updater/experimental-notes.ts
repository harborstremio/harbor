import type { ReleaseNote } from "./release-notes";

// Bundled by exact internal version: installed notes work offline and never
// accidentally show the latest feed's notes for a different installation.
const notes: Record<string, ReleaseNote> = {
  "0.999.4": {
    title: "Harbor Experimental 0.0.4",
    intro:
      "An early look at changes for Harbor’s next beta. Back up Harbor before testing; this build is not a replacement for the regular beta.",
    sections: [
      {
        heading: "What’s new",
        items: [
          "Experimental release notes stay available in Settings after installation, including offline.",
          "Select an X-Ray actor to browse their movies and TV shows without leaving the player.",
          "Full Edge TTS voice discovery for ebooks (#1409).",
          "TV navigation, settings focus and home search improvements (#1408), with RTL improvements for Big Picture, poster dock and live TV multiview (#1406).",
          "Linux MPRIS media controls and metadata (#1372).",
          "Drag-and-drop list reordering (#1361) and descriptions for custom and featured lists (#1371).",
        ],
      },
      {
        heading: "Fixes and retained changes",
        items: [
          "Arabic/English subtitle identity and grouping fixes, plus manual Live Try timing preservation.",
          "Watch-progress season selection (#1401), encrypted HLS playback improvements (#1400), and ElegantFin sidebar/back alignment (#1399).",
          "Earlier experimental audio-device recovery, desktop notifications, controller and manga changes remain included.",
          "Updated regression tests and UI fallback coverage (#1407).",
          "Latest beta removes Discord account sign-in, linking and recovery. Discord Rich Presence remains available.",
        ],
      },
      {
        heading: "Please test",
        items: [
          "Reopen these notes after restarting Harbor and with the network disconnected.",
          "Open an actor from X-Ray, browse movies and TV shows, then close or go Back. Check keyboard/controller activation and that playback stays in place.",
          "Switch Arabic → English → Arabic, reopen the subtitle menu, and select Off while subtitles load. Check Live Try after seeking and pause/resume.",
          "Check TV navigation in English and Arabic, list order/description persistence, ebook voices, and Linux desktop media controls.",
          "Check playback, audio-device switching, settings/library retention and a publisher-approved return to beta. Record the exact platform and build tested.",
        ],
      },
      {
        heading: "Thank you",
        items: [
          "Credits: kalashnikxvxiii, O1Abdulrahman, anmol210202, pengunnn, OwaisByte, Thunderhawkk, uddx7, Talal1011 and the Harbor contributors.",
          "Report issues at harborsystem.online with your build, OS and reproduction steps. Remove passwords, tokens and private URLs before sharing logs or screenshots.",
        ],
      },
    ],
  },
};

export function experimentalReleaseNote(version: string | null | undefined): ReleaseNote | null {
  return version && Object.hasOwn(notes, version) ? notes[version] : null;
}
