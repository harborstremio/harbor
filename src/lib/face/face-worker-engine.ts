import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";
import * as ort from "onnxruntime-web/wasm";
import ortWasmUrl from "./ort/ort-wasm-simd-threaded.wasm?url";
import ortMjsUrl from "./ort/ort-wasm-simd-threaded.mjs?url";
import { align112, faceToTensor, mpKeypointsTo4pt } from "./align";
import { l2normalize, MIN_BOX_PX } from "./match";
import type { WireFace } from "./match";

ort.env.wasm.wasmPaths = { wasm: ortWasmUrl, mjs: ortMjsUrl };
// X-Ray already runs in its own worker. Keeping ORT single-threaded prevents it
// from spawning nested workers that require cross-origin isolation in WebView2.
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.simd = true;

const MP_WASM = "/mp-wasm";
const DETECTOR_MODEL = "/models/face/face_detection_full_range.tflite";
const RECOGNIZER_MODEL = "/models/face/face_recognition_sface_2021dec_int8.onnx";

async function loadModel(url: string, what: string): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(`${what} could not be fetched from ${url}`);
  }
  if (!response.ok) throw new Error(`${what} is missing (${url} returned ${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
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
    // This engine runs inside an ES module worker. The classic MediaPipe loader
    // relies on importScripts(), which module workers reject; its fallback then
    // imports the script without publishing ModuleFactory to the worker global.
    // Harbor ships MediaPipe's module-worker runtime locally, so select it
    // explicitly instead of relaxing CSP or loading executable code remotely.
    fileset = await FilesetResolver.forVisionTasks(MP_WASM, true);
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

export function ensureWorkerFaceEngine(): Promise<void> {
  if (!readyPromise) {
    readyPromise = boot().catch((error) => {
      readyPromise = null;
      detector = null;
      session = null;
      throw error;
    });
  }
  return readyPromise;
}

async function embedCanvas(canvas: OffscreenCanvas): Promise<Float32Array> {
  const currentSession = session as ort.InferenceSession;
  const input = new ort.Tensor("float32", faceToTensor(canvas), [1, 3, 112, 112]);
  try {
    const outputs = await currentSession.run({ [currentSession.inputNames[0]]: input });
    try {
      const output = outputs[currentSession.outputNames[0]];
      const embedding = Float32Array.from(output.data as ArrayLike<number>);
      return l2normalize(embedding);
    } finally {
      for (const output of Object.values(outputs)) output.dispose();
    }
  } finally {
    input.dispose();
  }
}

const MIN_FACES_PER_SCAN = 5;
const MAX_FACES_PER_SCAN = 8;
const FACE_SCAN_BUDGET_MS = 220;

export async function scanWorkerFrame(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): Promise<WireFace[]> {
  if (!detector) return [];
  const result = detector.detect(bitmap);
  const candidates: { detection: (typeof result.detections)[number]; area: number }[] = [];
  for (const detection of result.detections) {
    const box = detection.boundingBox;
    if (!box || box.width < MIN_BOX_PX || box.height < MIN_BOX_PX) continue;
    if (detection.keypoints.length < 4) continue;
    candidates.push({ detection, area: box.width * box.height });
  }

  candidates.sort((a, b) => b.area - a.area);
  const faces: WireFace[] = [];
  const startedAt = performance.now();
  for (const { detection } of candidates.slice(0, MAX_FACES_PER_SCAN)) {
    if (faces.length >= MIN_FACES_PER_SCAN && performance.now() - startedAt >= FACE_SCAN_BUDGET_MS)
      break;
    const box = detection.boundingBox;
    if (!box) continue;
    const points = mpKeypointsTo4pt(detection.keypoints, width, height);
    const embedding = await embedCanvas(align112(bitmap, points));
    faces.push({
      box: { x: box.originX, y: box.originY, w: box.width, h: box.height },
      embedding: Array.from(embedding),
    });
  }
  return faces;
}

export async function embedWorkerLargestFace(bitmap: ImageBitmap): Promise<number[] | null> {
  if (!detector) return null;
  const result = detector.detect(bitmap);
  let best: (typeof result.detections)[number] | null = null;
  let area = 0;
  for (const detection of result.detections) {
    const box = detection.boundingBox;
    if (!box || detection.keypoints.length < 4) continue;
    const candidateArea = box.width * box.height;
    if (candidateArea > area) {
      area = candidateArea;
      best = detection;
    }
  }
  if (!best?.boundingBox) return null;
  const points = mpKeypointsTo4pt(best.keypoints, bitmap.width, bitmap.height);
  return Array.from(await embedCanvas(align112(bitmap, points)));
}
