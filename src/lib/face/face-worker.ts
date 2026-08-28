/// <reference lib="webworker" />

import {
  embedWorkerLargestFace,
  ensureWorkerFaceEngine,
  scanWorkerFrame,
} from "./face-worker-engine";
import type { FaceWorkerRequest, FaceWorkerResponse } from "./face-worker-protocol";

const scope = self as DedicatedWorkerGlobalScope;
let queue = Promise.resolve();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function handle(request: FaceWorkerRequest): Promise<void> {
  try {
    let result: undefined | Awaited<ReturnType<typeof scanWorkerFrame>> | number[] | null;
    switch (request.type) {
      case "ensure":
        await ensureWorkerFaceEngine();
        result = undefined;
        break;
      case "scan":
        try {
          await ensureWorkerFaceEngine();
          result = await scanWorkerFrame(request.bitmap, request.width, request.height);
        } finally {
          request.bitmap.close();
        }
        break;
      case "embed-largest":
        try {
          await ensureWorkerFaceEngine();
          result = await embedWorkerLargestFace(request.bitmap);
        } finally {
          request.bitmap.close();
        }
        break;
    }
    const response: FaceWorkerResponse = { id: request.id, ok: true, result };
    scope.postMessage(response);
  } catch (error) {
    const response: FaceWorkerResponse = {
      id: request.id,
      ok: false,
      error: errorMessage(error),
    };
    scope.postMessage(response);
  }
}

scope.addEventListener("message", (event: MessageEvent<FaceWorkerRequest>) => {
  const request = event.data;
  queue = queue.then(
    () => handle(request),
    () => handle(request),
  );
});
