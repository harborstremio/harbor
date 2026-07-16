import { useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth";
import { SettingsProvider } from "@/lib/settings";
import {
  modalOverlayClose,
  modalOverlayEmitAction,
  modalOverlayGetPending,
  onModalShow,
  onModalState,
  type ModalPayload,
} from "@/lib/modal-overlay";
import { AudioModal, type AudioModalState } from "@/components/popups/audio-modal";
import { SubtitleModal, type SubtitleModalState } from "@/components/popups/subtitle-modal";

export function ModalOverlayApp() {
  useEffect(() => {
    document.documentElement.style.background = "rgba(0,0,0,0.92)";
    document.body.style.background = "rgba(0,0,0,0.92)";
    const root = document.getElementById("root");
    if (root) root.style.background = "rgba(0,0,0,0.92)";
  }, []);

  return (
    <AuthProvider>
      <SettingsProvider>
        <ModalRouter />
      </SettingsProvider>
    </AuthProvider>
  );
}

function ModalRouter() {
  const [payload, setPayload] = useState<ModalPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void modalOverlayGetPending().then((p) => {
      if (!cancelled && p) setPayload(p);
    });
    const unShow = onModalShow((p) => setPayload(p));
    const unState = onModalState((p) => setPayload(p));
    return () => {
      cancelled = true;
      void unShow.then((fn) => fn()).catch(() => {});
      void unState.then((fn) => fn()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void modalOverlayClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => {
    void modalOverlayClose();
  };

  if (!payload) {
    return <div className="fixed inset-0" style={{ background: "transparent" }} />;
  }

  if (payload.kind === "subtitle") {
    return (
      <SubtitleModal
        state={payload.state as SubtitleModalState}
        onSelect={(id) => modalOverlayEmitAction("modal://subtitle/select", { id })}
        onDelay={(sec) => modalOverlayEmitAction("modal://subtitle/delay", { sec })}
        onAddSubtitle={(url, lang, title, metadata) =>
          modalOverlayEmitAction("modal://subtitle/add", { url, lang, title, ...metadata })
        }
        onClose={close}
      />
    );
  }

  if (payload.kind === "audio") {
    return (
      <AudioModal
        state={payload.state as AudioModalState}
        onSelect={(id) => modalOverlayEmitAction("modal://audio/select", { id })}
        onDelay={(sec) => modalOverlayEmitAction("modal://audio/delay", { sec })}
        onClose={close}
      />
    );
  }

  return <div className="fixed inset-0" style={{ background: "transparent" }} onClick={close} />;
}
