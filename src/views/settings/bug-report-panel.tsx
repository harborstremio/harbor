import { AlertTriangle, AtSign, Award, FileText, User } from "./icons";
import { GitHubIcon } from "@/components/github-icon";
import { useEffect, useState, type ReactNode } from "react";
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
import { SettingRow } from "./kit";
import { Section, ToggleRow } from "./shared";
import { SButton } from "./ui";
import { usePageActions } from "./page-actions";
import { ContributorCard } from "./bug-report/contributor-card";
import { DiagnosticsCard } from "./bug-report/diagnostics-card";
import { FileDrop } from "./bug-report/file-drop";
import { SeverityPicker } from "./bug-report/severity-picker";
import { SuccessCard } from "./bug-report/success-card";

const QUAL =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

const FIELD =
  "h-11 w-full max-w-[520px] min-w-0 rounded-[10px] border border-edge-soft bg-elevated px-4 text-[16.5px] text-ink outline-none placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const AREA =
  "w-full max-w-[520px] min-w-0 resize-y rounded-[10px] border border-edge-soft bg-elevated px-4 py-3 text-[16.5px] leading-[25px] text-ink outline-none placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
      debridCount: [settings.rdKey, settings.tbKey, settings.adKey, settings.pmKey, settings.dlKey].filter(Boolean).length,
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

  usePageActions(
    submittedId
      ? []
      : [
          {
            id: "bug-report-submit",
            label: submitting ? "Sending…" : "Submit bug report",
            tone: "primary",
            disabled: !canSubmit,
            onSelect: () => void submit(),
          },
        ],
    submittedId
      ? undefined
      : canSubmit
        ? "Ready to send"
        : summary.trim().length < 6
          ? "Summary needs at least 6 characters"
          : "Preparing…",
  );

  if (submittedId) return <SuccessCard id={submittedId} onAnother={reset} />;

  return (
    <>
      <Section
        title={t("What broke?")}
        subtitle={t("A specific summary lands faster than a long paragraph. Steps to reproduce help most of all.")}
      >
        <SettingRow
          wide
          label={
            <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
              <span className="min-w-0">{t("Summary")}</span>
              <span className={`${QUAL} bg-accent-soft text-accent`}>{t("Required")}</span>
            </span>
          }
          desc={t("Name what broke in one sentence. Maintainers read this line first.")}
        >
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={240}
            placeholder={t("Player freezes after the second episode autoplays")}
            className={FIELD}
          />
        </SettingRow>

        <SettingRow
          wide
          label={t("Severity")}
          desc={t("Low is cosmetic. Normal is annoying. High means a feature is broken. Critical means Harbor is unusable.")}
        >
          <SeverityPicker value={severity} onChange={setSeverity} />
        </SettingRow>

        <SettingRow
          wide
          label={t("Steps to reproduce")}
          desc={t("Number every step from a fresh start. This is the single most useful thing in a report.")}
        >
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            rows={6}
            placeholder={`1. Open Movies\n2. Click The Substance\n3. Press Play\n4. ...`}
            className={AREA}
          />
        </SettingRow>

        <SettingRow
          wide
          label={t("What you expected")}
          desc={t("Describe the result you were after.")}
        >
          <textarea
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            rows={4}
            placeholder={t("Stream should start playing within a few seconds.")}
            className={AREA}
          />
        </SettingRow>

        <SettingRow
          wide
          label={t("What actually happened")}
          desc={t("Describe what Harbor did instead, including any message on screen.")}
        >
          <textarea
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            rows={4}
            placeholder={t("Spinner stays forever and nothing in the player loads.")}
            className={AREA}
          />
        </SettingRow>
      </Section>

      <Section
        title={t("Screenshots and recordings")}
        subtitle={t("Drop a clip of the bug if you can. A 5-second screen recording usually says more than five paragraphs.")}
      >
        <FileDrop files={files} onChange={setFiles} />
      </Section>

      <Section
        title={t("Player log")}
        subtitle={t("If a stream or the video player misbehaves, the log usually names the cause.")}
      >
        <ExportLogButton />
      </Section>

      <Section
        title={t("Credit (optional)")}
        subtitle={t("Bug reporters get listed in the release notes when their report leads to a shipped fix. Leave blank to stay anonymous.")}
      >
        <CreditField
          icon={<User size={18} strokeWidth={1.9} />}
          label={t("Display name")}
          desc={t("Appears in the release notes. Use whatever name you want credit under.")}
          value={reporterName}
          onChange={setReporterName}
          placeholder={t("Your name")}
          maxLength={120}
        />
        <CreditField
          icon={<GitHubIcon size={18} />}
          label={t("GitHub username")}
          desc={t("We tag this account on the issue so you see the fix land.")}
          value={reporterGithub}
          onChange={setReporterGithub}
          placeholder={t("username")}
          maxLength={60}
        />
        <CreditField
          icon={<AtSign size={18} strokeWidth={1.9} />}
          label={t("Contact email or Discord")}
          desc={t("Used only if we need one more detail to reproduce the bug.")}
          value={reporterContact}
          onChange={setReporterContact}
          placeholder={t("Email address or Discord handle")}
          maxLength={200}
        />
        <ToggleRow
          leading={<Award size={18} strokeWidth={1.9} />}
          label={t("Credit me in the release notes if this report leads to a fix.")}
          sub={t("Turn this off and the report ships with no name attached.")}
          value={consentCredit}
          onChange={setConsentCredit}
        />
      </Section>

      <Section title={t("What gets sent")}>
        <DiagnosticsCard diag={diag} />
      </Section>

      <ContributorCard />

      {error && (
        <div className="mt-7 flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
          <AlertTriangle size={18} strokeWidth={2.2} className="mt-[3px] shrink-0 text-danger" />
          <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-danger">
            {t("Could not send: {error}", { error })}
          </p>
        </div>
      )}

    </>
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
      setDetail(t("Saved to Downloads as harbor-mpv-log.txt. Attach it above."));
    } catch (e) {
      setState("error");
      setDetail(e instanceof Error ? e.message : String(e));
    }
  };

  const done = state === "done" && detail;

  return (
    <SettingRow
      icon={<FileText size={18} strokeWidth={1.9} />}
      label={t("Export player log")}
      desc={
        done
          ? detail
          : t("Writes the last playback session to your Downloads folder so you can attach it above.")
      }
      warn={state === "error" && detail ? t("Export failed: {error}", { error: detail }) : undefined}
    >
      <SButton onClick={() => void run()} disabled={state === "exporting"}>
        {state === "exporting"
          ? t("Exporting…")
          : state === "done"
            ? t("Export again")
            : t("Export log")}
      </SButton>
    </SettingRow>
  );
}

function CreditField({
  icon,
  label,
  desc,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  icon: ReactNode;
  label: string;
  desc: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength?: number;
}) {
  return (
    <SettingRow wide icon={icon} label={label} desc={desc}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        spellCheck={false}
        autoComplete="off"
        className={FIELD}
      />
    </SettingRow>
  );
}
