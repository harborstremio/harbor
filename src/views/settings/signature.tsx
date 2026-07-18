import { ChevronDown } from "lucide-react";
import { useState } from "react";

export function Signature() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-center gap-2 pt-2 pb-1">
      <p className="flex items-center gap-1.5 text-center text-[12px] tracking-wide text-ink-subtle">
        Made with
        <HeartGlyph />
        by the Harbor team
      </p>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-ink-subtle/80 transition-colors hover:text-ink-muted"
      >
        Know more
        <ChevronDown
          size={12}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="mt-1 max-w-md space-y-3 px-2 text-[12.5px] leading-relaxed text-ink-subtle">
          <p>
            Harbor is a completely free and open source project. Harbor is under the MIT License and
            you can repurpose and reuse as you wish. By all means profit off of this, shape it to
            your wishes and needs, whatever your heart desires. It is truly Open Source.
          </p>
          <p>
            We originally built this as our own personal client. We love Stremio so much and wanted
            to put our own spin on a protocol we use almost daily. It started off as a simple clean
            player, and as our friends started using it too, it grew into something bigger: watch
            together, insta play, and a lot more.
          </p>
          <p>A special thank you to the team at Stremio-Addons. Please consider supporting them.</p>
          <p>
            This little footnote area we intend to keep unprofessional as opposed to the rest of
            this project. We hope you enjoy!
          </p>
        </div>
      )}
    </div>
  );
}

function HeartGlyph() {
  return (
    <svg
      width="13"
      height="12"
      viewBox="0 0 24 22"
      fill="currentColor"
      aria-label="love"
      className="inline-block translate-y-[0.5px] text-accent"
    >
      <path d="M12 21.4c-.5 0-.9-.2-1.3-.5C4.6 15.7 1 12.5 1 8.3 1 4.8 3.8 2 7.3 2c2 0 3.8 1 4.7 2.4C12.9 3 14.7 2 16.7 2 20.2 2 23 4.8 23 8.3c0 4.2-3.6 7.4-9.7 12.6-.4.3-.8.5-1.3.5z" />
    </svg>
  );
}
