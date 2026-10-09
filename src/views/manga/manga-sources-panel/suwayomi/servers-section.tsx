import { Check, Pencil, Plus, Server, Trash2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { CARD } from "../shared";
import { ServerForm } from "./server-form";
import { removeServer, setActiveServer } from "./servers-store";
import { useServers } from "./use-servers";
import { initials, serverHost, type SuwayomiServer } from "./types";

function ServerAvatar({ name }: { name: string }) {
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-canvas text-ink-muted ring-1 ring-edge-soft">
      <span className="text-[13px] font-bold">{initials(name)}</span>
    </span>
  );
}

function ServerRow({ server, active }: { server: SuwayomiServer; active: boolean }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  const remove = () => {
    setRemoving(true);
    window.setTimeout(() => removeServer(server.id), 240);
  };

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ${
        removing ? "max-h-0 scale-95 opacity-0" : editing ? "max-h-[900px]" : "max-h-28"
      } ${CARD} ${active ? "ring-2 ring-accent/50" : ""}`}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <button
          type="button"
          onClick={() => setActiveServer(server.id)}
          className="flex min-w-0 flex-1 items-center gap-4 text-start active:scale-[0.99] motion-reduce:active:scale-100"
        >
          <ServerAvatar name={server.name} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2 truncate text-[16px] font-semibold text-ink">
              {server.name}
              {active && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-[11px] font-bold text-accent">
                  <Check size={12} strokeWidth={3} /> {t("Active")}
                </span>
              )}
            </span>
            <span className="truncate text-[13px] text-ink-subtle">
              {serverHost(server.baseUrl)}
              {server.auth ? ` · ${t("authenticated")}` : ""}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-label={t("Edit {name}", { name: server.name })}
          aria-expanded={editing}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ring-edge-soft transition-all active:scale-95 motion-reduce:active:scale-100 ${
            editing ? "bg-accent/15 text-accent" : "bg-raised text-ink-subtle hover:text-ink"
          }`}
        >
          <Pencil size={17} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={remove}
          aria-label={t("Remove {name}", { name: server.name })}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-raised text-ink-subtle ring-1 ring-edge-soft transition-all hover:text-danger active:scale-95 motion-reduce:active:scale-100"
        >
          <Trash2 size={18} strokeWidth={2} />
        </button>
      </div>
      {editing && (
        <div className="harbor-rise border-t border-edge-soft p-5">
          <ServerForm edit={server} onDone={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

function AddServerCard() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className={`transition-all ${open ? "ring-edge" : "hover:ring-edge"} ${CARD}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-start active:scale-[0.99] motion-reduce:active:scale-100"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-canvas text-ink-muted ring-1 ring-edge-soft">
          <Server size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[16px] font-semibold text-ink">{t("Connect a Suwayomi server")}</span>
          <span className="truncate text-[13px] text-ink-muted">
            {t("Point Harbor at your self-hosted library to browse and install sources")}
          </span>
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-ink-muted ring-1 ring-edge-soft">
          <Plus size={18} strokeWidth={2.4} className={`transition-transform ${open ? "rotate-45" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="harbor-rise border-t border-edge-soft p-5">
          <ServerForm onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

export function ServersSection() {
  const t = useT();
  const { servers, active } = useServers();
  return (
    <div className="flex flex-col gap-3">
      <p className="mt-2 px-1 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-subtle">
        {t("Servers")}
      </p>
      {servers.map((s) => (
        <ServerRow key={s.id} server={s} active={active?.id === s.id} />
      ))}
      <AddServerCard />
    </div>
  );
}
