import type {
  FaceWorkerPayload,
  FaceWorkerResponse,
  FaceWorkerResult,
} from "./face-worker-protocol";
import type { WireFace } from "./match";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

function rejectPending(reason: Error): void {
  for (const request of pending.values()) request.reject(reason);
  pending.clear();
}

function stopWorker(current: Worker, reason: Error): void {
  current.terminate();
  if (worker !== current) return;
  worker = null;
  readyPromise = null;
  rejectPending(reason);
}

function getWorker(): Worker {
  if (worker) return worker;
  const next = new Worker(new URL("./face-worker.ts", import.meta.url), {
    type: "module",
    name: "harbor-xray-face",
  });
  next.addEventListener("message", (event: MessageEvent<FaceWorkerResponse>) => {
    const response = event.data;
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    if (response.ok) request.resolve(response.result);
    else request.reject(new Error(response.error));
  });
  next.addEventListener("error", () => {
    stopWorker(next, new Error("X-Ray face worker failed"));
  });
  next.addEventListener("messageerror", () => {
    stopWorker(next, new Error("X-Ray face worker returned an unreadable result"));
  });
  worker = next;
  return next;
}

function request<T extends keyof FaceWorkerPayload>(
  current: Worker,
  message: FaceWorkerPayload[T],
  transfer: Transferable[] = [],
): Promise<FaceWorkerResult[T]> {
  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    pending.set(id, {
      resolve: (value) => resolve(value as FaceWorkerResult[T]),
      reject,
    });
    try {
      current.postMessage({ ...message, id }, transfer);
    } catch (error) {
      pending.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export function ensureFaceEngine(): Promise<void> {
  if (readyPromise) return readyPromise;
  const current = getWorker();
  readyPromise = request<"ensure">(current, { type: "ensure" })
    .then(() => undefined)
    .catch((error) => {
      if (worker === current) stopWorker(current, error);
      throw error;
    });
  return readyPromise;
}

export function releaseFaceEngine(): void {
  if (!worker) {
    readyPromise = null;
    return;
  }
  stopWorker(worker, new Error("X-Ray face worker stopped"));
}

export async function scanFrame(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): Promise<WireFace[]> {
  await ensureFaceEngine();
  const current = worker;
  if (!current) throw new Error("X-Ray face worker is unavailable");
  return request<"scan">(current, { type: "scan", bitmap, width, height }, [bitmap]);
}

export async function embedLargestFace(bitmap: ImageBitmap): Promise<number[] | null> {
  await ensureFaceEngine();
  const current = worker;
  if (!current) throw new Error("X-Ray face worker is unavailable");
  return request<"embed-largest">(current, { type: "embed-largest", bitmap }, [bitmap]);
}
