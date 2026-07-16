import { AtSign, User } from "lucide-react";
import { Github } from "@/components/icons/github-icon";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuth } from "@/lib/auth";
import {
  collectDiagnostics,
  installBugReportErrorCapture,
  submitBugReport,
  type Diagnostics,
  type Severity,
} from "@/lib/bug-report";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section } from "./shared";
import { ContributorCard } from "./bug-report/contributor-card";
import { DiagnosticsCard } from "./bug-report/diagnostics-card";
import { FileDrop } from "./bug-report/file-drop";
import { SeverityPicker } from "./bug-report/severity-picker";
import { SuccessCard } from "./bug-report/success-card";

export function BugReportPanel() {
  const t = useT();
  const { settings } = useSettings();
  const auth = useAuth();
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState<Severity>("normal");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [reporterName, setReporterName] = useState("");
  const [reporterGithub, setReporterGithub] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [consentCredit, setConsentCredit] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [diag, setDiag] = useState<Diagnostics | null>(null);

  useEffect(() => installBugReportErrorCapture(), []);

  useEffect(() => {
    let cancelled = false;
    void collectDiagnostics({
      playerEngine: settings.playerEngine,
      region: settings.region,
      hasTmdb: !!settings.tmdbKey,
      hasRpdb: !!settings.rpdbKey,
      hasTrakt: !!settings.traktAccessToken,
      hasStremio: !!auth.authKey,
      debridCount: [
        settings.rdKey,
        settings.tbKey,
        settings.adKey,
        settings.pmKey,
        settings.dlKey,
      ].filter(Boolean).length,
      addonCount: 0,
      iptvCount: settings.iptvPlaylists.length,
    }).then((d) => {
      if (!cancelled) setDiag(d);
    });
    return () => {
      cancelled = true;
    };
  }, [
    settings.playerEngine,
    settings.region,
    settings.tmdbKey,
    settings.rpdbKey,
    settings.traktAccessToken,
    settings.iptvPlaylists.length,
    settings.rdKey,
    settings.tbKey,
    settings.adKey,
    settings.pmKey,
    settings.dlKey,
    auth.authKey,
  ]);

  const canSubmit = summary.trim().length >= 6 && diag && !submitting;

  const submit = async () => {
    if (!canSubmit || !diag) return;
    setSubmitting(true);
    setError(null);
    try {
      const { id } = await submitBugReport(
        {
          summary: summary.trim(),
          severity,
          steps: steps.trim(),
          expected: expected.trim(),
          actual: actual.trim(),
          reporterName: reporterName.trim(),
          reporterGithub: reporterGithub.trim().replace(/^@/, ""),
          reporterContact: reporterContact.trim(),
          consentCredit,
          files,
        },
        diag,
      );
      setSubmittedId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSummary("");
    setSeverity("normal");
    setSteps("");
    setExpected("");
    setActual("");
    setFiles([]);
    setError(null);
    setSubmittedId(null);
  };

  if (submittedId) return <SuccessCard id={submittedId} onAnother={reset} />;

  return (
    <div className="flex flex-col gap-6">
      <Section
        title={t("What broke?")}
        subtitle={t(
          "A specific summary lands faster than a long paragraph. Steps to reproduce help most of all.",
        )}
      >
        <Field label={t("Summary")} required>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={240}
            placeholder={t("Player freezes after the second episode autoplays")}
            className="h-12 rounded-xl border border-edge bg-canvas px-4 text-[14px] text-ink placeholder:text-ink-subtle outline-none focus:border-ink"
          />
        </Field>

        <Field label={t("Severity")}>
          <SeverityPicker value={severity} onChange={setSeverity} />
        </Field>

        <Field label={t("Steps to reproduce")}>
          <TextArea
            value={steps}
            onChange={setSteps}
            rows={6}
            placeholder={`1. Open Movies\n2. Click The Substance\n3. Press Play\n4. ...`}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("What you expected")}>
            <TextArea
              value={expected}
              onChange={setExpected}
              rows={4}
              placeholder={t("Stream should start playing within a few seconds.")}
            />
          </Field>
          <Field label={t("What actually happened")}>
            <TextArea
              value={actual}
              onChange={setActual}
              rows={4}
              placeholder={t("Spinner stays forever and nothing in the player loads.")}
            />
          </Field>
        </div>
      </Section>

      <Section
        title={t("Screenshots and recordings")}
        subtitle={t(
          "Drop a clip of the bug if you can. A 5-second screen recording usually says more than five paragraphs.",
        )}
      >
        <FileDrop files={files} onChange={setFiles} />
      </Section>

      <Section
        title={t("Player log")}
        subtitle={t(
          "If a stream or the video player misbehaves, export the player log and attach it above. It saves to your Downloads folder.",
        )}
      >
        <ExportLogButton />
      </Section>

      <Section
        title={t("Credit (optional)")}
        subtitle={t(
          "Bug reporters get listed in the release notes when their report leads to a shipped fix. Leave blank to stay anonymous.",
        )}
      >
        <div className="flex flex-col divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-canvas focus-within:border-ink-subtle sm:flex-row sm:divide-y-0 sm:divide-x">
          <CreditField
            icon={<User size={14} strokeWidth={1.9} />}
            value={reporterName}
            onChange={setReporterName}
            placeholder={t("Display name")}
            maxLength={120}
          />
          <CreditField
            icon={<Github size={14} strokeWidth={1.9} />}
            value={reporterGithub}
            onChange={setReporterGithub}
            placeholder={t("GitHub username")}
            maxLength={60}
          />
          <CreditField
            icon={<AtSign size={14} strokeWidth={1.9} />}
            value={reporterContact}
            onChange={setReporterContact}
            placeholder={t("Email or Discord")}
            maxLength={200}
          />
        </div>
        <label className="mt-3 flex items-center gap-2.5 rounded-xl border border-edge-soft/60 bg-canvas/30 px-4 py-3">
          <input
            type="checkbox"
            checked={consentCredit}
            onChange={(e) => setConsentCredit(e.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          <span className="text-[12.5px] text-ink-muted">
            {t("Credit me in the release notes if this report leads to a fix.")}
          </span>
        </label>
      </Section>

      <ContributorCard />

      <DiagnosticsCard diag={diag} />

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-[12.5px] text-danger">
          {t("Could not send: {error}", { error })}
        </div>
      )}

      <div className="sticky bottom-3 z-10 flex items-center justify-end gap-3 rounded-2xl border border-edge-soft bg-elevated/85 px-5 py-3 backdrop-blur">
        <span className="me-auto text-[11.5px] text-ink-subtle">
          {canSubmit
            ? t("Ready to send")
            : summary.trim().length < 6
              ? t("Summary needs at least 6 characters")
              : t("Preparing…")}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="h-11 rounded-xl bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {submitting ? t("Sending…") : t("Submit bug report")}
        </button>
      </div>
    </div>
  );
}

function ExportLogButton() {
  const t = useT();
  const [state, setState] = useState<"idle" | "exporting" | "done" | "error">("idle");
  const [detail, setDetail] = useState<string | null>(null);

  const run = async () => {
    setState("exporting");
    setDetail(null);
    try {
      await invoke<string>("mpv_export_log");
      setState("done");
      setDetail(t("Saved to Downloads as harbor-mpv-log.txt"));
    } catch (e) {
      setState("error");
      setDetail(e instanceof Error ? e.message : String(e));
    }
  };

  const pill =
    state === "exporting"
      ? {
          dot: "bg-amber-400 animate-pulse",
          text: t("Exporting"),
          chip: "bg-amber-500/15 text-amber-300",
        }
      : state === "done"
        ? { dot: "bg-emerald-400", text: t("Exported"), chip: "bg-emerald-500/15 text-emerald-400" }
        : state === "error"
          ? { dot: "bg-danger", text: t("Failed"), chip: "bg-danger/15 text-danger" }
          : null;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={state === "exporting"}
          className="h-11 w-fit rounded-xl border border-edge bg-canvas px-5 text-[13.5px] font-semibold text-ink transition-colors hover:border-ink-subtle disabled:opacity-50"
        >
          {t("Export player log")}
        </button>
        {pill && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${pill.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
            {pill.text}
          </span>
        )}
      </div>
      {detail && <p className="text-[12px] leading-relaxed text-ink-muted">{detail}</p>}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
        {required && <span className="ms-1 text-accent">*</span>}
      </span>
      {children}
    </label>
  );
}

function CreditField({
  icon,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength?: number;
}) {
  return (
    <label className="flex h-11 flex-1 items-center gap-2 px-3.5 transition-colors hover:bg-elevated/40">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-ink-subtle">
        {icon}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        spellCheck={false}
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-subtle outline-none"
      />
    </label>
  );
}

function TextArea({
  value,
  onChange,
  rows,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="resize-y rounded-xl border border-edge bg-canvas px-3.5 py-2.5 text-[13px] leading-relaxed text-ink placeholder:text-ink-subtle outline-none focus:border-ink"
    />
  );
}
