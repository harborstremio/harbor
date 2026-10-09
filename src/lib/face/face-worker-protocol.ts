import type { WireFace } from "./match";

export type FaceWorkerRequest =
  | { id: number; type: "ensure" }
  | { id: number; type: "scan"; bitmap: ImageBitmap; width: number; height: number }
  | { id: number; type: "embed-largest"; bitmap: ImageBitmap };

export type FaceWorkerPayload = {
  ensure: { type: "ensure" };
  scan: { type: "scan"; bitmap: ImageBitmap; width: number; height: number };
  "embed-largest": { type: "embed-largest"; bitmap: ImageBitmap };
};

export type FaceWorkerResult = {
  ensure: undefined;
  scan: WireFace[];
  "embed-largest": number[] | null;
};

export type FaceWorkerResponse =
  | { id: number; ok: true; result: FaceWorkerResult[keyof FaceWorkerResult] }
  | { id: number; ok: false; error: string };
