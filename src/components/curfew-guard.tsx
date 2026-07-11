import { HarborMark } from "@/components/icons/harbor-mark";
import { loadCurfew, saveCurfew, type CurfewRecord } from "@/lib/curfew";
import { useT } from "@/lib/i18n";
import { verifyProfilePassword } from "@/lib/profile-password";
import { useProfiles, type Profile } from "@/lib/profiles";
import { useView } from "@/lib/view";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function CurfewGuard() {
  const { activeProfile, openPicker } = useProfiles();
  const { player, exitPlayer } = useView();
  const profileId = activeProfile?.id ?? null;
  const limit = activeProfile?.kid?.curfewMinutes ?? null;

  const [rec, setRec] = useState<CurfewRecord>(() =>
    profileId ? loadCurfew(profileId) : { date: "", seconds: 0, unlocked: false },
  );

  useEffect(() => {
    if (profileId) setRec(loadCurfew(profileId));
  }, [profileId]);

  const locked = !!limit && !rec.unlocked && rec.seconds >= limit * 60;

  useEffect(() => {
    if (!profileId || !limit || locked || !player) return;
    const id = window.setInterval(() => {
      setRec((r) => {
        const next = { ...r, seconds: r.seconds + 1 };
        saveCurfew(profileId, next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [profileId, limit, locked, player]);

  useEffect(() => {
    if (locked && player) exitPlayer();
  }, [locked, player, exitPlayer]);

  if (!locked || !profileId || !activeProfile) return null;

  return (
    <CurfewLockdown
      profile={activeProfile}
      onUnlock={() => {
        const next = { ...rec, unlocked: true };
        saveCurfew(profileId, next);
        setRec(next);
      }}
      onSwitch={() => openPicker({ kind: "list" })}
    />
  );
}

function CurfewLockdown({
  profile,
  onUnlock,
  onSwitch,
}: {
  profile: Profile;
  onUnlock: () => void;
  onSwitch: () => void;
}) {
  const t = useT();
  const hash = profile.kid?.parentPinHash ?? null;
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const submit = async (val: string) => {
    if (!hash) return;
    const ok = await verifyProfilePassword(val, hash);
    if (ok) {
      onUnlock();
    } else {
      setError(true);
      setPin("");
      window.setTimeout(() => setError(false), 600);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#3aa6c4] via-[#1c789f] to-[#0a3d5c] px-8 text-center text-white">
      <Bubbles />
      <div className="curfew-bob pointer-events-none absolute bottom-[14%] left-[8%]">
        <img src="/kids/doodles/liloctored.png" alt="" draggable={false} className="h-24 w-auto opacity-80" />
      </div>
      <img
        src="/kids/doodles/lilpurpocto.png"
        alt=""
        draggable={false}
        className="pointer-events-none absolute bottom-[10%] right-[10%] h-20 w-auto opacity-70"
      />

      <HarborMark className="curfew-sail relative h-24 w-24" />
      <h1 className="relative mt-4 font-display text-[clamp(40px,7vw,72px)] font-bold leading-none tracking-tight drop-shadow-[0_3px_12px_rgba(0,0,0,0.35)]">
        {t("Time's up!")}
      </h1>
      <p className="relative mt-4 max-w-md text-[18px] font-medium leading-relaxed text-white/90">
        {t("The ship is sailing away. Thanks for watching with Harbor, it's time to listen to your grown-ups.")}
      </p>

      {hash ? (
        <div className="relative mt-9 flex flex-col items-center gap-3">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoFocus
            value={pin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 4);
              setPin(v);
              if (v.length === 4) void submit(v);
            }}
            placeholder="••••"
            className={`h-14 w-44 rounded-2xl border-2 bg-white/15 text-center text-[28px] font-bold tracking-[0.4em] text-white placeholder-white/40 outline-none transition-colors ${
              error ? "curfew-shake border-red-300" : "border-white/40 focus:border-white"
            }`}
          />
          <span className="text-[13px] text-white/75">
            {t("A grown-up can enter the parent PIN to keep watching.")}
          </span>
        </div>
      ) : (
        <p className="relative mt-8 text-[14px] text-white/80">{t("Ask a grown-up to switch profiles.")}</p>
      )}

      <button
        type="button"
        onClick={onSwitch}
        className="relative mt-7 h-11 rounded-full bg-white/15 px-6 text-[14px] font-bold text-white ring-1 ring-white/30 transition-colors hover:bg-white/25"
      >
        {t("Switch profile")}
      </button>
    </div>,
    document.body,
  );
}

const BUBBLES = [
  { left: 8, size: 14 },
  { left: 22, size: 9 },
  { left: 38, size: 18 },
  { left: 56, size: 11 },
  { left: 70, size: 15 },
  { left: 84, size: 10 },
  { left: 93, size: 13 },
];

function Bubbles() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="curfew-bubble absolute bottom-0 rounded-full bg-white/25"
          style={{
            left: `${b.left}%`,
            width: `${b.size}px`,
            height: `${b.size}px`,
            animationDelay: `-${(1 + ((i * 1.7) % 6)).toFixed(1)}s`,
            animationDuration: `${6 + (i % 4)}s`,
          }}
        />
      ))}
    </div>
  );
}
