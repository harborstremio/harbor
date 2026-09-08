import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ContextImageViewer } from "@/components/context-image-viewer";
import { MenuSurface, menuItemClass } from "@/components/context-menu/menu-surface";
import { copyContextImage, loadContextImage, saveContextImage } from "@/lib/context-image";
import "@/index.css";

const canvas = document.createElement("canvas");
canvas.width = 120;
canvas.height = 80;
const paint = canvas.getContext("2d")!;
paint.fillStyle = "#4f8cff";
paint.fillRect(0, 0, 120, 80);
paint.fillStyle = "#dfecff";
paint.fillRect(20, 20, 80, 40);
const image = {
  src: canvas.toDataURL("image/png"),
  label: "Harbor fixture image",
  filename: "harbor-fixture",
};
canvas.width = 0;
canvas.height = 0;

type FramePayload = {
  requestId: number;
  clientX: number;
  clientY: number;
  imageSrc?: string;
  linkUrl?: string;
  selection?: string;
};
type Probe = { name: string; passed: boolean; detail?: string };

function Fixture() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [frameImageSrc, setFrameImageSrc] = useState<string | null>(null);
  const [frameBlobSrc, setFrameBlobSrc] = useState<string | null>(null);
  const [viewer, setViewer] = useState(false);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const autorun = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let blob: string | null = null;
    void (async () => {
      const loaded = await loadContextImage(image);
      const source = isTauri()
        ? await invoke<string>("harbor_fixture_image_server", { png: Array.from(loaded.bytes) })
        : image.src;
      const probe = new Image();
      probe.src = source;
      await probe.decode();
      if (probe.naturalWidth !== 120 || probe.naturalHeight !== 80)
        throw new Error("Fixture HTTP image did not decode correctly");
      if (!cancelled) {
        blob = URL.createObjectURL(loaded.blob);
        setFrameBlobSrc(blob);
        setFrameImageSrc(source);
      }
    })().catch((error) => setStatus(String(error)));
    return () => {
      cancelled = true;
      if (blob) URL.revokeObjectURL(blob);
    };
  }, []);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    const probes: Probe[] = [];
    const nativeTargets: unknown[] = [];
    const stopTargets = await listen("harbor:fixture-native-target", (event) =>
      nativeTargets.push(event.payload),
    );
    const check = async (name: string, action: () => Promise<string | void>) => {
      try {
        const detail = await action();
        probes.push({ name, passed: true, ...(detail ? { detail } : {}) });
      } catch (error) {
        probes.push({
          name,
          passed: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
      setStatus(
        probes
          .map(
            (result) =>
              `${result.passed ? "PASS" : "FAIL"} ${result.name}${result.detail ? `: ${result.detail}` : ""}`,
          )
          .join("\n"),
      );
    };
    await check("Original PNG load", async () => {
      const loaded = await loadContextImage(image);
      if (loaded.extension !== "png" || loaded.bytes[0] !== 137)
        throw new Error("PNG bytes changed");
    });
    await check("Native Copy image", async () => {
      await copyContextImage(image);
      // This fixture reads only after writing its own deterministic image.
      const { Image: NativeImage } = await import("@tauri-apps/api/image");
      const resource = new NativeImage(await invoke<number>("plugin:clipboard-manager|read_image"));
      try {
        const size = await resource.size();
        const rgba = await resource.rgba();
        if (size.width !== 120 || size.height !== 80 || rgba.length !== 120 * 80 * 4)
          throw new Error("Clipboard image dimensions changed");
        for (let y = 0; y < 80; y++)
          for (let x = 0; x < 120; x++) {
            const at = (y * 120 + x) * 4;
            const light = x >= 20 && x < 100 && y >= 20 && y < 60;
            if (
              rgba[at] !== (light ? 223 : 79) ||
              rgba[at + 1] !== (light ? 236 : 140) ||
              rgba[at + 2] !== 255 ||
              rgba[at + 3] !== 255
            )
              throw new Error("Clipboard image pixels changed");
          }
      } finally {
        await resource.close();
      }
      return "Own 120×80 RGBA fixture round-tripped pixel-exactly; both image resources released";
    });
    await check("App-owned blob image load", async () => {
      const loaded = await loadContextImage(image);
      const url = URL.createObjectURL(loaded.blob);
      try {
        const blobImage = await loadContextImage({ src: url });
        if (blobImage.bytes.length !== loaded.bytes.length) throw new Error("Blob bytes changed");
      } finally {
        URL.revokeObjectURL(url);
      }
    });
    await check("Native HTTP image loading from isolated loopback fixture", async () => {
      const loaded = await loadContextImage({ src: frameImageSrc! });
      if (loaded.extension !== "png") throw new Error("Native HTTP bytes were not PNG");
      return "Decoded 120×80 image; native HTTP response validated; no external network content";
    });
    await check("Review identity and paths", async () => {
      if (!(await invoke<boolean>("is_context_review"))) throw new Error("Wrong app identity");
      const path = await invoke<string>("harbor_download_dir");
      if (!path.includes("app.harbor.context-review"))
        throw new Error("Downloads escaped review data");
    });
    await check("Native editor command filtering", async () => {
      const input = document.querySelector("input")!;
      const bounds = input.getBoundingClientRect();
      let release: (() => void) | undefined;
      let timer: number | undefined;
      try {
        let receive!: (names: string[]) => void;
        const response = new Promise<string[]>((resolve, reject) => {
          receive = resolve;
          timer = window.setTimeout(
            () => reject(new Error("No native editing event received")),
            4000,
          );
        });
        release = await listen<string[]>("harbor:fixture-native-edit-menu", (event) =>
          receive(event.payload),
        );
        const [names] = await Promise.all([
          response,
          invoke("harbor_fixture_right_click", { x: bounds.left + 30, y: bounds.top + 20 }),
        ]);
        if (
          !names.includes("paste") ||
          !names.includes("selectAll") ||
          names.some((name) => ["inspectElement", "reload", "back"].includes(name))
        )
          throw new Error(`Unexpected native editor items: ${names.join(", ")}`);
        return `WebView2 editor items: ${names.join(", ")}; popup display suppressed during autorun`;
      } finally {
        clearTimeout(timer);
        release?.();
      }
    });
    await check("Sandboxed Canvas HTTP image/link native metadata and coordinates", async () => {
      const bounds = frame.current!.getBoundingClientRect();
      const x = bounds.left + 16 + 60;
      const y = bounds.top + 56;
      let unlisten: (() => void) | undefined;
      let timer: number | undefined;
      try {
        let receive!: (payload: FramePayload) => void;
        let fail!: (error: unknown) => void;
        const response = new Promise<FramePayload>((resolve, reject) => {
          receive = resolve;
          fail = reject;
          timer = window.setTimeout(
            () => reject(new Error("No native frame context event received")),
            4000,
          );
        });
        unlisten = await listen<FramePayload>("harbor:frame-context-menu", (event) => {
          clearTimeout(timer);
          void invoke<boolean>("harbor_ack_frame_context", {
            requestId: event.payload.requestId,
            handled: true,
          })
            .then((accepted) => {
              if (accepted) receive(event.payload);
              else fail(new Error("Frame request lease expired"));
            })
            .catch(fail);
        });
        const [payload] = await Promise.all([
          response,
          invoke("harbor_fixture_right_click", { x, y }),
        ]);
        if (payload.imageSrc !== frameImageSrc || payload.linkUrl !== "https://example.com/fixture")
          throw new Error("Native target did not match the sandbox image/link");
        if (Math.abs(payload.clientX - x) > 4 || Math.abs(payload.clientY - y) > 4)
          throw new Error(`Coordinate mismatch at DPR ${devicePixelRatio}`);
        const expired = await invoke<boolean>("harbor_ack_frame_context", {
          requestId: payload.requestId,
          handled: true,
        });
        if (expired) throw new Error("The same native lease was consumed twice");
        return `Native srcDoc metadata matched at DPR ${devicePixelRatio}; lease consumed once`;
      } finally {
        clearTimeout(timer);
        unlisten?.();
      }
    });
    await check("Sandboxed Canvas nontransferable blob preserves native fallback", async () => {
      const bounds = frame.current!.getBoundingClientRect();
      let timer: number | undefined;
      let release: (() => void) | undefined;
      try {
        let receive!: (detail: string) => void;
        const response = new Promise<string>((resolve, reject) => {
          receive = resolve;
          timer = window.setTimeout(
            () => reject(new Error("Expected native image fallback was not reported")),
            4000,
          );
        });
        release = await listen<string>("harbor:fixture-native-image-fallback", (event) =>
          receive(event.payload),
        );
        const [detail] = await Promise.all([
          response,
          invoke("harbor_fixture_right_click", { x: bounds.left + 220, y: bounds.top + 56 }),
        ]);
        return `${detail}; popup display suppressed during autorun`;
      } finally {
        clearTimeout(timer);
        release?.();
      }
    });
    setBusy(false);
    stopTargets();
    if (isTauri())
      await invoke("harbor_fixture_finish", {
        report: {
          fixture: "Harbor Context Review",
          passed: probes.every((probe) => probe.passed),
          probes,
          nativeTargets,
          nativeEditingVisualCheck:
            "Not automated; use the editable field to inspect the native menu",
          saveDialogCheck: "Not automated; use Save image",
        },
      });
  };

  useEffect(() => {
    if (
      !ready ||
      autorun.current ||
      !(window as unknown as Record<string, unknown>).__HARBOR_CONTEXT_FIXTURE_AUTORUN__
    )
      return;
    autorun.current = true;
    void run();
  }, [ready]);

  return (
    <main className="min-h-screen bg-canvas p-8 text-ink">
      <h1 className="text-2xl font-semibold">Harbor Context Review</h1>
      <p className="mt-2 text-ink-muted">
        Isolated native fixture. No accounts, media libraries, or production startup services are
        loaded.
      </p>
      <div className="my-6 flex gap-4">
        <button
          className="rounded-xl bg-elevated p-4"
          onClick={() => setViewer(true)}
          onContextMenu={(event) => {
            event.preventDefault();
            setPoint({ x: event.clientX, y: event.clientY });
          }}
        >
          <img src={image.src} alt="Harbor fixture" />
          <span className="mt-2 block">Image and context menu</span>
        </button>
        <label className="flex flex-col gap-2">
          Native editing
          <input
            className="rounded-lg border border-edge bg-elevated p-3"
            defaultValue="Harbor fixture editing text"
          />
        </label>
      </div>
      {frameImageSrc && (
        <iframe
          ref={frame}
          title="Sandboxed Canvas fixture"
          sandbox=""
          referrerPolicy="no-referrer"
          onLoad={() => setReady(true)}
          className="h-40 w-96 border-0 bg-white"
          srcDoc={`<!doctype html><html><body style="margin:16px"><a href="https://example.com/fixture"><img width="120" height="80" src="${frameImageSrc}" alt="Canvas fixture"></a><img style="position:absolute;left:160px;top:16px" width="120" height="80" src="${frameBlobSrc}" alt="Opaque blob fallback fixture"><a style="position:absolute;left:16px;top:112px;height:24px" href="https://example.com/fixture">Canvas fixture link</a></body></html>`}
        />
      )}
      <button
        disabled={!ready || busy}
        className="mt-6 block rounded-lg bg-accent px-4 py-2 text-white disabled:opacity-40"
        onClick={() => void run()}
      >
        Run native fixture checks
      </button>
      <pre className="mt-4 whitespace-pre-wrap text-sm" role="status">
        {status}
      </pre>
      {point && (
        <MenuSurface point={point} onClose={() => setPoint(null)} label="Fixture image">
          <button
            role="menuitem"
            className={menuItemClass}
            onClick={() => {
              setPoint(null);
              setViewer(true);
            }}
          >
            View image
          </button>
          <button
            role="menuitem"
            className={menuItemClass}
            onClick={() => {
              setPoint(null);
              void copyContextImage(image)
                .then(() => setStatus("Image copied"))
                .catch((error) => setStatus(String(error)));
            }}
          >
            Copy image
          </button>
          <button
            role="menuitem"
            className={menuItemClass}
            onClick={() => {
              setPoint(null);
              void saveContextImage(image)
                .then((result) => setStatus(result.saved ? "Saved" : "Cancelled"))
                .catch((error) => setStatus(String(error)));
            }}
          >
            Save image
          </button>
        </MenuSurface>
      )}
      {viewer && <ContextImageViewer image={image} onClose={() => setViewer(false)} />}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
