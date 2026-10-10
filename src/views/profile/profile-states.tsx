import { ArrowLeft, Lock, RefreshCw, UserX } from "lucide-react";
import { useT } from "@/lib/i18n";

function Shell({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface text-ink-muted ring-1 ring-edge-soft">
        {icon}
      </div>
      <h2 className="font-display text-[22px] text-ink">{title}</h2>
      <p className="mt-2 text-[14px] text-ink-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ProfileError({ onRetry, onBack }: { onRetry: () => void; onBack: () => void }) {
  const t = useT();
  return (
    <Shell
      icon={<RefreshCw size={28} />}
      title={t("Could not load this profile")}
      body={t("Something went wrong reaching Harbor. Check your connection and try again.")}
      action={
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-surface px-4 text-[14px] font-medium text-ink-muted ring-1 ring-edge-soft hover:bg-elevated"
          >
            <ArrowLeft size={20} /> {t("Back")}
          </button>
          <button
            onClick={onRetry}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-[14px] font-semibold text-canvas hover:opacity-90"
          >
            <RefreshCw size={20} /> {t("Retry")}
          </button>
        </div>
      }
    />
  );
}

export function ProfileEmpty({ handle, onBack }: { handle: string; onBack: () => void }) {
  const t = useT();
  return (
    <Shell
      icon={<UserX size={28} />}
      title={t("No such captain")}
      body={t("We could not find anyone at @{handle}. The handle may have changed or the profile was removed.", { handle })}
      action={
        <button
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-[14px] font-semibold text-canvas hover:opacity-90"
        >
          <ArrowLeft size={20} /> {t("Back")}
        </button>
      }
    />
  );
}

export function ProfilePrivate({ alias }: { alias: string }) {
  const t = useT();
  return (
    <Shell
      icon={<Lock size={28} />}
      title={t("{alias} keeps this private", { alias })}
      body={t("This member has hidden their showcase, activity and friends from public view.")}
    />
  );
}
