
export type ShaderStage = "prescale" | "restore" | "chroma" | "sharpen" | "tonemap";
export type ShaderContent = "all" | "anime" | "hdr" | "live";

export type ShaderVariant = { id: string; label: string; sub: string; files: string[] };

export type ShaderCatalogEntry = {
  id: string;
  name: string;
  category: string;
  content: ShaderContent;
  tier: "fast" | "quality" | "heavy";
  description: string;
  stage: ShaderStage;
  source: { label: string; url: string };
  files: string[];
  variants?: ShaderVariant[];
  companionProps?: Record<string, string>;
  conflictsWith?: Array<"hdrToSdr" | "rtxHdr">;
  verify?: boolean;
  demo?: { before: string; after: string; credit: string };
};

function demoFor(id: string, credit: string) {
  return {
    before: `/shader-demos/${id}/before.webp`,
    after: `/shader-demos/${id}/after.webp`,
    credit,
  };
}

export const STAGE_ORDER: Record<ShaderStage, number> = {
  prescale: 10,
  restore: 20,
  chroma: 30,
  sharpen: 40,
  tonemap: 90,
};

export const SHADER_CATALOG: ShaderCatalogEntry[] = [
  {
    id: "fsrcnnx",
    name: "FSRCNNX",
    category: "Neural upscaler",
    content: "all",
    tier: "quality",
    description:
      "A neural network that doubles luma resolution. The sharpest general-purpose upscaler, strong on both live action and anime. Pick one variant.",
    stage: "prescale",
    source: { label: "igv/FSRCNN-TensorFlow", url: "https://github.com/igv/FSRCNN-TensorFlow" },
    files: ["FSRCNNX_x2_16-0-4-1.glsl"],
    variants: [
      {
        id: "hq",
        label: "High quality",
        sub: "16-0-4-1. The reference variant, heaviest on the GPU.",
        files: ["FSRCNNX_x2_16-0-4-1.glsl"],
      },
      {
        id: "light",
        label: "Light",
        sub: "8-0-4-1. Half the passes, kinder to weaker cards.",
        files: ["FSRCNNX_x2_8-0-4-1.glsl"],
      },
    ],
    demo: demoFor("fsrcnnx", "Harbor, from a public domain frame"),
  },
  {
    id: "fsr",
    name: "AMD FSR",
    category: "Spatial upscaler",
    content: "all",
    tier: "fast",
    description:
      "AMD FidelityFX Super Resolution. A fast spatial upscaler that fires when the video is smaller than the window. A great default for live action where Anime4K is the wrong tool.",
    stage: "prescale",
    source: {
      label: "agyild (gist)",
      url: "https://gist.github.com/agyild/82219c545228d70c5604f865ce0b0ce5",
    },
    files: ["FSR.glsl"],
    demo: demoFor("fsr", "Harbor, from a public domain frame"),
  },
  {
    id: "nis",
    name: "NVIDIA NIS",
    category: "Spatial upscaler",
    content: "all",
    tier: "fast",
    description:
      "NVIDIA Image Scaling. A light spatial upscaler and sharpener, an alternative to FSR that runs well on any GPU.",
    stage: "prescale",
    source: {
      label: "agyild (gist)",
      url: "https://gist.github.com/agyild/7e8951915b2bf24526a9343d951db214",
    },
    files: ["NVScaler.glsl"],
    demo: demoFor("nis", "Harbor, from a public domain frame"),
  },
  {
    id: "sgsr",
    name: "Snapdragon SGSR",
    category: "Spatial upscaler",
    content: "all",
    tier: "fast",
    description:
      "Qualcomm Snapdragon Game Super Resolution. A very cheap single-pass spatial upscaler, a lighter alternative to FSR on low-power hardware.",
    stage: "prescale",
    source: {
      label: "agyild (gist)",
      url: "https://gist.github.com/agyild/7715b6b1f38427839d58f80884902cab",
    },
    files: ["SGSR.glsl"],
    demo: demoFor("sgsr", "Harbor, from a public domain frame"),
  },
  {
    id: "ravu",
    name: "RAVU Lite",
    category: "Luma prescaler",
    content: "anime",
    tier: "fast",
    description:
      "A trained luma doubler that is cheap enough to leave on. Excellent on anime and flat-shaded sources. Pick a radius, larger is sharper and heavier.",
    stage: "prescale",
    source: { label: "bjin/mpv-prescalers", url: "https://github.com/bjin/mpv-prescalers" },
    files: ["ravu-lite-r3.hook"],
    variants: [
      { id: "r3", label: "Radius 3", sub: "The balanced default.", files: ["ravu-lite-r3.hook"] },
      { id: "r4", label: "Radius 4", sub: "Sharpest, heaviest.", files: ["ravu-lite-r4.hook"] },
      {
        id: "r2",
        label: "Radius 2",
        sub: "Lightest, for weaker cards.",
        files: ["ravu-lite-r2.hook"],
      },
    ],
    demo: demoFor("ravu", "Harbor, from a public domain frame"),
  },
  {
    id: "nnedi3",
    name: "NNEDI3",
    category: "Neural upscaler",
    content: "all",
    tier: "heavy",
    description:
      "A classic neural edge-directed luma doubler. Very high quality, heavy on the GPU. More neurons means sharper and slower.",
    stage: "prescale",
    source: { label: "bjin/mpv-prescalers", url: "https://github.com/bjin/mpv-prescalers" },
    files: ["nnedi3-nns32-win8x4.hook"],
    variants: [
      {
        id: "nns32",
        label: "32 neurons",
        sub: "The practical default.",
        files: ["nnedi3-nns32-win8x4.hook"],
      },
      {
        id: "nns64",
        label: "64 neurons",
        sub: "Sharper, heavier.",
        files: ["nnedi3-nns64-win8x4.hook"],
      },
      {
        id: "nns128",
        label: "128 neurons",
        sub: "Reference quality, very heavy.",
        files: ["nnedi3-nns128-win8x4.hook"],
      },
    ],
    demo: demoFor("nnedi3", "Harbor, from a public domain frame"),
  },
  {
    id: "ssimsuperres",
    name: "SSimSuperRes",
    category: "Detail refine",
    content: "all",
    tier: "quality",
    description:
      "Runs after an upscaler to recover the detail and sharpness a doubler softens. Best paired with FSRCNNX or RAVU, not used alone.",
    stage: "restore",
    source: {
      label: "igv (gist)",
      url: "https://gist.github.com/igv/2364ffa6e81540f29cb7ab4c9bc05b6b",
    },
    files: ["SSimSuperRes.glsl"],
    demo: demoFor("ssimsuperres", "Harbor, from a public domain frame"),
  },
  {
    id: "krig",
    name: "KrigBilateral",
    category: "Chroma upscaler",
    content: "all",
    tier: "quality",
    description:
      "A high quality chroma upscaler. Fixes the color blur and bleeding of default chroma scaling, most visible on saturated edges and subtitles.",
    stage: "chroma",
    source: {
      label: "igv (gist)",
      url: "https://gist.github.com/igv/a015fc885d5c22e6891820ad89555637",
    },
    files: ["KrigBilateral.glsl"],
    demo: demoFor("krig", "Harbor, from a public domain frame"),
  },
  {
    id: "adaptive-sharpen",
    name: "Adaptive Sharpen",
    category: "Sharpener",
    content: "all",
    tier: "fast",
    description:
      "Edge-aware sharpening that lifts soft detail without the halos of a naive sharpen. An alternative to CAS, run one or the other, not both.",
    stage: "sharpen",
    source: {
      label: "igv (gist)",
      url: "https://gist.github.com/igv/8a77e4eb8276753b54bb94c1c50c317e",
    },
    files: ["adaptive-sharpen.glsl"],
    demo: demoFor("adaptive-sharpen", "Harbor, from a public domain frame"),
  },
  {
    id: "cas",
    name: "Contrast Adaptive Sharpening",
    category: "Sharpener",
    content: "all",
    tier: "fast",
    description:
      "AMD's cheap, natural sharpener. Runs last in the chain and lifts detail on soft sources without the halos of a naive sharpen.",
    stage: "sharpen",
    source: {
      label: "agyild (gist)",
      url: "https://gist.github.com/agyild/bbb4e58298b2f86aa24da3032a0d2ee6",
    },
    files: ["CAS.glsl"],
    demo: demoFor("cas", "Harbor, from a public domain frame"),
  },
  {
    id: "hdr-toys",
    name: "hdr-toys tone-mapping",
    category: "HDR to SDR",
    content: "hdr",
    tier: "quality",
    description:
      "High quality HDR to SDR tone and gamut mapping as a shader pipeline, for PQ (HDR10) sources. Use this instead of Harbor's built-in tone-mapping. Turn off the built-in HDR to SDR conversion first, it cannot run alongside this. Needs the gpu-next renderer, so it is reliable on Windows and unverified on macOS.",
    stage: "tonemap",
    source: {
      label: "natural-harmonia-gropius/hdr-toys",
      url: "https://github.com/natural-harmonia-gropius/hdr-toys",
    },
    files: ["clip_both.glsl", "pq_inv.glsl", "astra.glsl", "bottosson.glsl", "bt1886.glsl"],
    companionProps: {
      "tone-mapping": "clip",
      "gamut-mapping-mode": "clip",
      "target-colorspace-hint": "no",
      "target-prim": "bt.2020",
      "target-trc": "pq",
    },
    conflictsWith: ["hdrToSdr", "rtxHdr"],
    verify: true,
    demo: demoFor("hdr-toys", "natural-harmonia-gropius"),
  },
];

export function shaderEntry(id: string): ShaderCatalogEntry | undefined {
  return SHADER_CATALOG.find((e) => e.id === id);
}
