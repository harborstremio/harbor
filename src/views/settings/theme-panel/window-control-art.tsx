type Style = "transparent" | "glass" | "filled";

export function WindowControlArt({ style, on }: { style: Style; on: boolean }) {
  const plate =
    style === "filled"
      ? "bg-ink/[0.14]"
      : style === "glass"
        ? "bg-ink/[0.07]"
        : "bg-transparent";
  return (
    <span
      aria-hidden
      className={`relative block h-10 w-[68px] shrink-0 overflow-hidden rounded-md bg-canvas ${
        on ? "" : "opacity-40 saturate-0"
      }`}
    >
      <span className="absolute inset-x-0 top-0 block h-[13px] bg-ink/[0.05]" />
      <span
        className={`absolute end-[5px] top-[3px] flex h-[7px] items-center gap-[3px] rounded-[2px] px-[3px] ${plate}`}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-[3px] w-[3px] rounded-full bg-ink/55" />
        ))}
      </span>
      <span className="absolute start-[6px] top-[19px] block h-[3px] w-[26px] rounded-full bg-ink/[0.16]" />
      <span className="absolute start-[6px] top-[26px] block h-[3px] w-[17px] rounded-full bg-ink/[0.10]" />
      <span className="absolute end-[6px] bottom-[6px] block h-[9px] w-[22px] rounded-[2px] bg-ink/[0.08]" />
    </span>
  );
}

export function TitleBarArt({ native, on }: { native: boolean; on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative block h-10 w-[68px] shrink-0 overflow-hidden rounded-md bg-canvas ${
        on ? "" : "opacity-40 saturate-0"
      }`}
    >
      {native ? (
        <>
          <span className="absolute inset-x-0 top-0 block h-[12px] bg-ink/[0.16]" />
          <span className="absolute end-[4px] top-[4px] flex items-center gap-[4px]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="block h-[4px] w-[4px] rounded-full bg-ink/60" />
            ))}
          </span>
        </>
      ) : (
        <span className="absolute end-[5px] top-[4px] flex items-center gap-[4px]">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-[3px] w-[3px] rounded-full bg-ink/40" />
          ))}
        </span>
      )}
      <span
        className="absolute start-[6px] block h-[3px] w-[26px] rounded-full bg-ink/[0.16]"
        style={{ top: native ? 20 : 17 }}
      />
      <span
        className="absolute start-[6px] block h-[3px] w-[17px] rounded-full bg-ink/[0.10]"
        style={{ top: native ? 27 : 24 }}
      />
      <span className="absolute end-[6px] bottom-[6px] block h-[9px] w-[22px] rounded-[2px] bg-ink/[0.08]" />
    </span>
  );
}

export function HybridBarArt({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative block h-10 w-[68px] shrink-0 overflow-hidden rounded-md bg-canvas ${
        on ? "" : "opacity-40 saturate-0"
      }`}
    >
      <span className="absolute inset-x-0 top-0 block h-[13px] bg-ink/[0.05]" />
      <span className="absolute end-[5px] top-[4px] flex items-center gap-[4px]">
        {["bg-ink/45", "bg-ink/30", "bg-ink/30"].map((c, i) => (
          <span key={i} className={`block h-[4px] w-[4px] rounded-full ${on ? c : "bg-ink/25"}`} />
        ))}
      </span>
      <span className="absolute start-[6px] top-[19px] block h-[3px] w-[26px] rounded-full bg-ink/[0.16]" />
      <span className="absolute start-[6px] top-[26px] block h-[3px] w-[17px] rounded-full bg-ink/[0.10]" />
      <span className="absolute end-[6px] bottom-[6px] block h-[9px] w-[22px] rounded-[2px] bg-ink/[0.08]" />
    </span>
  );
}
