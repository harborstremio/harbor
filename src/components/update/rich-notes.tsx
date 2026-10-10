import type { NoteMedia, ReleaseNote } from "@/lib/updater/release-notes";

export function RichNote({ note }: { note: ReleaseNote }) {
  return (
    <div className="flex flex-col gap-3.5">
      {(note.media || note.title) && (
        <div className="flex items-center gap-3">
          {note.media && <NoteMediaView media={note.media} />}
          {note.title && (
            <h2 className="font-display text-[22px] font-medium leading-tight tracking-tight text-ink">
              {note.title}
            </h2>
          )}
        </div>
      )}
      {note.intro && <p className="text-[13px] leading-relaxed text-ink-muted">{note.intro}</p>}
      {note.sections?.map((section, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          {section.heading && (
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-subtle">
              {section.heading}
            </span>
          )}
          <ul className="flex flex-col gap-1.5">
            {section.items.map((item, j) => (
              <li key={j} className="flex gap-2.5 text-[13px] leading-relaxed text-ink">
                <span
                  aria-hidden
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function NoteMediaView({ media }: { media: NoteMedia }) {
  const height = media.height ?? 64;
  return (
    <img
      src={media.src}
      alt={media.alt ?? ""}
      draggable={false}
      style={{
        height,
        width: "auto",
        imageRendering: media.kind === "sprite" ? "pixelated" : undefined,
      }}
      className="shrink-0 select-none"
    />
  );
}
