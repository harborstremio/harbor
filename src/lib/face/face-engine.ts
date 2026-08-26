import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";
import * as ort from "onnxruntime-web/wasm";
import ortWasmUrl from "./ort/ort-wasm-simd-threaded.wasm?url";
import ortMjsUrl from "./ort/ort-wasm-simd-threaded.mjs?url";
import { align112, faceToTensor, mpKeypointsTo4pt } from "./align";
import { l2normalize, MIN_BOX_PX } from "./match";
import type { WireFace } from "./match";

ort.env.wasm.wasmPaths = { wasm: ortWasmUrl, mjs: ortMjsUrl };
const canThread = typeof SharedArrayBuffer !== "undefined" && globalThis.crossOriginIsolated === true;
// This work shares a process with the player. Two workers are enough for the
// occasional recognition pass and avoid monopolising laptop CPUs.
ort.env.wasm.numThreads = canThread ? Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1)) : 1;
ort.env.wasm.proxy = false;
ort.env.wasm.simd = true;

const MP_WASM = "/mp-wasm";
const DETECTOR_MODEL = "/models/face/face_detection_full_range.tflite";
const RECOGNIZER_MODEL = "/models/face/face_recognition_sface_2021dec_int8.onnx";
async function loadModel(url: string, what: string): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(`${what} could not be fetched from ${url}`);
  }
  if (!res.ok) throw new Error(`${what} is missing (${url} returned ${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder().decode(bytes.slice(0, 64)).trim().toLowerCase();
  if (bytes.byteLength < 1024 || head.startsWith("<!doctype") || head.startsWith("<html")) {
    throw new Error(`${what} is missing from public${url}`);
  }
  return bytes;
}

let detector: FaceDetector | null = null;
let session: ort.InferenceSession | null = null;
let readyPromise: Promise<void> | null = null;

async function boot(): Promise<void> {
  const [detectorModel, recognizerModel] = await Promise.all([
    loadModel(DETECTOR_MODEL, "The face detection model"),
    loadModel(RECOGNIZER_MODEL, "The face recognition model"),
  ]);
  let fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
  try {
    fileset = await FilesetResolver.forVisionTasks(MP_WASM);
  } catch {
    throw new Error(`The MediaPipe runtime is missing from public${MP_WASM}`);
  }
  detector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: detectorModel, delegate: "CPU" },
    runningMode: "IMAGE",
    minDetectionConfidence: 0.5,
  });
  session = await ort.InferenceSession.create(recognizerModel, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
}

export function ensureFaceEngine(): Promise<void> {
  if (!readyPromise) {
    readyPromise = boot().catch((e) => {
      readyPromise = null;
      detector = null;
      session = null;
      throw e;
    });
  }
  return readyPromise;
}

async function embedCanvas(canvas: OffscreenCanvas): Promise<Float32Array> {
  const s = session as ort.InferenceSession;
  const input = new ort.Tensor("float32", faceToTensor(canvas), [1, 3, 112, 112]);
  const out = await s.run({ [s.inputNames[0]]: input });
  return l2normalize(out[s.outputNames[0]].data as Float32Array);
}

const MAX_FACES_PER_SCAN = 5;

export async function scanFrame(bitmap: ImageBitmap, w: number, h: number): Promise<WireFace[]> {
  if (!detector) return [];
  const result = detector.detect(bitmap);
  const candidates: { d: (typeof result.detections)[number]; area: number }[] = [];
  for (const d of result.detections) {
    const bb = d.boundingBox;
    if (!bb || bb.width < MIN_BOX_PX || bb.height < MIN_BOX_PX) continue;
    if (d.keypoints.length < 4) continue;
    candidates.push({ d, area: bb.width * bb.height });
  }

  candidates.sort((a, b) => b.area - a.area);
  const faces: WireFace[] = [];
  for (const { d } of candidates.slice(0, MAX_FACES_PER_SCAN)) {
    const bb = d.boundingBox;
    if (!bb) continue;
    const pts = mpKeypointsTo4pt(d.keypoints, w, h);
    const emb = await embedCanvas(align112(bitmap, pts));
    faces.push({
      box: { x: bb.originX, y: bb.originY, w: bb.width, h: bb.height },
      embedding: Array.from(emb),
    });
  }
  return faces;
}

export async function embedLargestFace(bitmap: ImageBitmap): Promise<number[] | null> {
  if (!detector) return null;
  const result = detector.detect(bitmap);
  let best: (typeof result.detections)[number] | null = null;
  let area = 0;
  for (const d of result.detections) {
    const bb = d.boundingBox;
    if (!bb || d.keypoints.length < 4) continue;
    const a = bb.width * bb.height;
    if (a > area) {
      area = a;
      best = d;
    }
  }
  if (!best || !best.boundingBox) return null;
  const pts = mpKeypointsTo4pt(best.keypoints, bitmap.width, bitmap.height);
  const emb = await embedCanvas(align112(bitmap, pts));
  return Array.from(emb);
}
