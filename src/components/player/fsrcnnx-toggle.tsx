import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

type Status = "idle" | "downloading" | "ready" | "error";

export function FsrcnnxToggle() {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // On mount check if shader is already downloaded
  useEffect(() => {
    invoke<string | null>("fsrcnnx_dir")
      .then((dir) => {
        if (dir) setStatus("ready");
      })
      .catch(() => {});
  }, []);

  // Sync enabled state with current mpv glsl-shaders
  useEffect(() => {
    const tick = async () => {
      const shaders = await invoke<string>("mpv_get_property", {
        name: "glsl-shaders",
      }).catch(() => "");
      setEnabled(shaders.toLowerCase().includes("fsrcnnx"));
    };
    void tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);

  async function handleToggle() {
    if (enabled) {
      await invoke("fsrcnnx_clear").catch(() => {});
      setEnabled(false);
      return;
    }
    // Need shader downloaded first
    if (status !== "ready") {
      setStatus("downloading");
      setErrorMsg("");
      try {
        await invoke("fsrcnnx_download", { force: false });
        setStatus("ready");
      } catch (e) {
        setStatus("error");
        setErrorMsg(String(e));
        return;
      }
    }
    try {
      await invoke("fsrcnnx_set");
      setEnabled(true);
    } catch (e) {
      setStatus("error");
      setErrorMsg(String(e));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            FSRCNNX Upscaling
          </p>
          <p className="text-xs text-white/50">
            Real-time x2 luma upscaling for live-action content (480p→1080p,
            720p→4K). Disable for native 4K. Mutually exclusive with Anime4K.
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={status === "downloading"}
          className={[
            "relative ml-4 h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200",
            enabled ? "bg-yellow-500" : "bg-white/20",
            status === "downloading" ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          ].join(" ")}
          aria-label={enabled ? "Disable FSRCNNX" : "Enable FSRCNNX"}
        >
          <span
            className={[
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
              enabled ? "translate-x-5" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </div>
      {status === "downloading" && (
        <p className="text-xs text-yellow-400">Downloading FSRCNNX shader…</p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-400">Error: {errorMsg}</p>
      )}
    </div>
  );
}
