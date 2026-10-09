import { CheckCircle2, Loader2, Lock, Plus, Save, XCircle } from "lucide-react";
import { useState } from "react";
import { testConnection } from "@/lib/manga/sources/suwayomi/provider";
import { useT } from "@/lib/i18n";
import { INPUT, PRIMARY_BTN } from "../shared";
import { addServer, updateServer } from "./servers-store";
import type { SuwayomiServer } from "./types";

type Probe = { state: "idle" | "testing" | "ok" | "fail"; label?: string };
type FailReason = "auth" | "not_found" | "unreachable" | "unsupported";

export function ServerForm({
  edit,
  onDone,
}: {
  edit?: SuwayomiServer;
  onDone: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(edit?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(edit?.baseUrl ?? "");
  const [showAuth, setShowAuth] = useState(!!edit?.auth);
  const [username, setUsername] = useState(edit?.auth?.username ?? "");
  const [password, setPassword] = useState(edit?.auth?.password ?? "");
  const [probe, setProbe] = useState<Probe>({ state: "idle" });
  const [failReason, setFailReason] = useState<FailReason | null>(null);
  const [error, setError] = useState<string | null>(null);

  const failText = (reason: FailReason | null): string => {
    switch (reason) {
      case "auth":
        return t("Wrong username or password");
      case "not_found":
        return t("No Suwayomi server at this address");
      case "unsupported":
        return t("This server responded but is not supported");
      default:
        return t("Could not reach this server");
    }
  };

  const authInput = showAuth && (username.trim() || password) ? { username, password } : undefined;
  const valid = /^https?:\/\/.+/i.test(baseUrl.trim().replace(/\/+$/, ""));

  const test = async () => {
    if (!valid) {
      setError(t("Enter a valid http(s):// server address"));
      return;
    }
    setError(null);
    setProbe({ state: "testing" });
    try {
      const res = await testConnection({ baseUrl: baseUrl.trim().replace(/\/+$/, ""), auth: authInput });
      if (res.ok) {
        setFailReason(null);
        setProbe({
          state: "ok",
          label: res.name ? `${res.name}${res.version ? ` · ${res.version}` : ""}` : undefined,
        });
      } else {
        setFailReason(res.reason ?? null);
        setProbe({ state: "fail" });
      }
    } catch {
      setFailReason(null);
      setProbe({ state: "fail" });
    }
  };

  const save = () => {
    if (!valid) {
      setError(t("Enter a valid http(s):// server address"));
      return;
    }
    const result = edit
      ? updateServer(edit.id, { name, baseUrl, auth: authInput ?? null })
      : addServer(name, baseUrl, authInput);
    if (!result) {
      setError(t("Could not save this server"));
      return;
    }
    onDone();
  };

  return (
    <div className="flex flex-col gap-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("Name (optional)")}
        spellCheck={false}
        className={INPUT}
      />
      <input
        value={baseUrl}
        onChange={(e) => {
          setBaseUrl(e.target.value);
          setProbe({ state: "idle" });
        }}
        placeholder="http://localhost:4567"
        inputMode="url"
        autoCapitalize="off"
        spellCheck={false}
        className={INPUT}
      />

      {showAuth ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-edge-soft bg-canvas/50 p-3">
          <div className="flex items-center gap-2 text-ink-muted">
            <Lock size={14} />
            <span className="text-[12.5px] font-semibold">{t("Basic authentication")}</span>
          </div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("Username")}
            autoCapitalize="off"
            spellCheck={false}
            className={INPUT}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("Password")}
            type="password"
            className={INPUT}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAuth(true)}
          className="self-start text-[13px] font-medium text-ink-subtle transition-colors hover:text-ink"
        >
          {t("This server needs a username and password")}
        </button>
      )}

      {error && <p className="text-[13px] font-medium text-danger">{error}</p>}

      {probe.state === "ok" && (
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-accent">
          <CheckCircle2 size={15} /> {probe.label ? t("Connected to {name}", { name: probe.label }) : t("Connected")}
        </p>
      )}
      {probe.state === "fail" && (
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-danger">
          <XCircle size={15} /> {failText(failReason)}
        </p>
      )}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={test}
          disabled={probe.state === "testing"}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-raised text-[14.5px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-all hover:text-ink active:scale-[0.98] disabled:opacity-60 motion-reduce:active:scale-100"
        >
          {probe.state === "testing" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {t("Test connection")}
        </button>
        <button type="button" onClick={save} className={`flex-1 ${PRIMARY_BTN}`}>
          {edit ? <Save size={17} strokeWidth={2.2} /> : <Plus size={17} strokeWidth={2.4} />}
          {edit ? t("Save") : t("Add server")}
        </button>
      </div>
    </div>
  );
}
