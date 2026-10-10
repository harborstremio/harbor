const IDLE_RELEASE_MS = 60000;

let element: HTMLVideoElement | null = null;
let park: HTMLElement | null = null;
let owner: object | null = null;
let releaseTimer: number | null = null;

function parkNode(): HTMLElement {
  if (park && park.isConnected) return park;
  const node = document.createElement("div");
  node.setAttribute("aria-hidden", "true");
  node.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none";
  document.body.appendChild(node);
  park = node;
  return node;
}

function node(): HTMLVideoElement {
  if (element) return element;
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "none";
  element = video;
  parkNode().appendChild(video);
  return video;
}

function cancelRelease(): void {
  if (releaseTimer === null) return;
  window.clearTimeout(releaseTimer);
  releaseTimer = null;
}

function scheduleRelease(): void {
  cancelRelease();
  releaseTimer = window.setTimeout(() => {
    releaseTimer = null;
    if (owner || !element || !element.getAttribute("src")) return;
    try {
      element.removeAttribute("src");
      element.load();
    } catch {
      void 0;
    }
  }, IDLE_RELEASE_MS);
}

export function claimTrailerVideo(token: object, mount: HTMLElement): HTMLVideoElement {
  cancelRelease();
  owner = token;
  const video = node();
  video.style.opacity = "0";
  if (video.parentElement !== mount) mount.appendChild(video);
  return video;
}

export function releaseTrailerVideo(token: object): void {
  if (owner !== token) return;
  owner = null;
  const video = element;
  if (!video) return;
  try {
    video.pause();
  } catch {
    void 0;
  }
  video.style.opacity = "0";
  parkNode().appendChild(video);
  scheduleRelease();
}

export function trailerVideoHeldBy(token: object): boolean {
  return owner === token;
}
