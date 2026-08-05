import { FilesetResolver, FaceDetector } from "@mediapipe/tasks-vision";
import * as ort from "onnxruntime-web/wasm";
import ortWasmUrl from "./ort/ort-wasm-simd-threaded.wasm?url";
import ortMjsUrl from "./ort/ort-wasm-simd-threaded.mjs?url";
import { align112, faceToTensor, mpKeypointsTo4pt } from "./align";
import { l2normalize, MIN_BOX_PX } from "./match";
import type { WireFace } from "./match";

ort.env.wasm.wasmPaths = { wasm: ortWasmUrl, mjs: ortMjsUrl };
ort.env.wasm.numThreads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
ort.env.wasm.proxy = false;
ort.env.wasm.simd = true;

let detector: FaceDetector | null = null;
let session: ort.InferenceSession | null = null;
let readyPromise: Promise<void> | null = null;

async function boot(): Promise<void> {
  const fileset = await FilesetResolver.forVisionTasks("/mp-wasm");
  detector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/models/face/face_detection_full_range.tflite", delegate: "CPU" },
    runningMode: "IMAGE",
    minDetectionConfidence: 0.5,
  });
  const bytes = new Uint8Array(
    await (await fetch("/models/face/face_recognition_sface_2021dec_int8.onnx")).arrayBuffer(),
  );
  session = await ort.InferenceSession.create(bytes, {
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

export async function scanFrame(bitmap: ImageBitmap, w: number, h: number): Promise<WireFace[]> {
  if (!detector) return [];
  const result = detector.detect(bitmap);
  const faces: WireFace[] = [];
  for (const d of result.detections) {
    const bb = d.boundingBox;
    if (!bb || bb.width < MIN_BOX_PX || bb.height < MIN_BOX_PX) continue;
    if (d.keypoints.length < 4) continue;
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
