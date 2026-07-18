import { Check, Clock, Lock } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { KidConfig } from "@/lib/profiles";

const KID_AVATARS = [1, 2, 3, 4, 5].map((n) => `/kids/avatars/kid-${n}.webp`);
const AGES = [3, 5, 7, 9, 12];
const CURFEWS: { label: string; v: number | null }[] = [
  { label: "No limit", v: null },
  { label: "30 min", v: 30 },
  { label: "1 hour", v: 60 },
  { label: "1½ hr", v: 90 },
  { label: "2 hr", v: 120 },
  { label: "3 hr", v: 180 },
];

export function KidsSetupPanel({
  avatar,
  setAvatar,
  kid,
  setKid,
  parentPin,
  setParentPin,
  hasExistingPin,
}: {
  avatar: string | null;
  setAvatar: (v: string) => void;
  kid: KidConfig;
  setKid: (next: KidConfig) => void;
  parentPin: string | null;
  setParentPin: (v: string | null) => void;
  hasExistingPin: boolean;
}) {
  const t = useT();
  const pinReady = (parentPin && parentPin.length === 4) || (hasExistingPin && parentPin == null);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#6bc5ca]/50 p-5 shadow-[0_16px_40px_-16px_rgba(15,82,119,0.7)]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#2f9ec0] via-[#1c789f] to-[#0c4a6e]" />
      <img
        src="/kids/doodles/lilpurpocto.png"
        alt=""
        draggable={false}
        className="pointer-events-none absolute right-4 top-9 h-14 opacity-80"
        style={{ transform: "scaleX(-1)" }}
      />
      <img
        src="/kids/doodles/stardots.png"
        alt=""
        draggable={false}
        className="pointer-events-none absolute bottom-3 right-3 h-12 opacity-90"
      />
      <div className="relative flex flex-col gap-5 text-white">
        <Section icon={null} label={t("Pick an avatar")}>
          <div className="flex flex-wrap gap-3">
            {KID_AVATARS.map((src) => {
              const on = avatar === src;
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => setAvatar(src)}
                  className="relative h-16 w-16 shrink-0 transition-transform duration-200 hover:scale-105"
                >
                  <span
                    className={`block h-full w-full overflow-hidden rounded-full bg-white/20 ${
                      on ? "ring-4 ring-white" : "ring-2 ring-white/40"
                    }`}
                  >
                    <img
                      src={src}
                      alt=""
                      draggable={false}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  {on && (
                    <span className="absolute -bottom-0.5 -end-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#0c4a6e] shadow-md">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        <Section icon={null} label={t("Age level")}>
          <div className="flex gap-2">
            {AGES.map((a) => (
              <Pill key={a} on={kid.age === a} onClick={() => setKid({ ...kid, age: a })}>
                {a}
              </Pill>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/75">
            {t("Shows titles suitable up to age {age}.", { age: kid.age })}
          </p>
        </Section>

        <Section icon={<Clock size={15} strokeWidth={2.4} />} label={t("Daily watch time")}>
          <div className="flex flex-wrap gap-2">
            {CURFEWS.map((c) => (
              <Pill
                key={c.label}
                on={kid.curfewMinutes === c.v}
                onClick={() => setKid({ ...kid, curfewMinutes: c.v })}
                wide
              >
                {t(c.label)}
              </Pill>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/75">
            {t("When time's up, the ship sails away until a parent unlocks it.")}
          </p>
        </Section>

        <Section icon={<Lock size={15} strokeWidth={2.4} />} label={t("Parent PIN")}>
          <div className="flex items-center gap-3">
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={parentPin ?? ""}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                setParentPin(v.length ? v : null);
              }}
              placeholder={hasExistingPin ? "••••" : t("4 digits")}
              className="h-11 w-44 rounded-xl border border-white/30 bg-white/15 px-4 text-center text-[16px] font-bold tracking-[0.18em] text-white placeholder-white/45 outline-none focus:border-white/70"
            />
            {pinReady && (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-white/85">
                <Check size={14} strokeWidth={3} />
                {hasExistingPin && parentPin == null ? t("PIN set") : t("Ready")}
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-white/75">
            {t("Used to lift Time's Up and to leave the kids space.")}
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/85">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

function Pill({
  on,
  onClick,
  wide,
  children,
}: {
  on: boolean;
  onClick: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-xl text-[14px] font-extrabold transition ${
        wide ? "px-4" : "flex-1"
      } ${
        on
          ? "bg-white text-[#0c4a6e] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.4)]"
          : "bg-white/15 text-white hover:bg-white/25"
      }`}
    >
      {children}
    </button>
  );
}
