function Plate({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-md bg-canvas">
      {children}
    </span>
  );
}

export function RailsArt() {
  return (
    <Plate>
      <span className="flex flex-col gap-[3px]">
        {[16, 22, 13].map((w, i) => (
          <span
            key={i}
            className="block h-[3px] rounded-full bg-current"
            style={{ width: w, opacity: 1 - i * 0.28 }}
          />
        ))}
      </span>
    </Plate>
  );
}

export function ScrobbleArt() {
  return (
    <Plate>
      <span className="flex items-center gap-[3px]">
        <span className="block h-[3px] w-[9px] rounded-full bg-current opacity-40" />
        <span className="block h-[9px] w-[9px] rounded-full bg-current" />
        <span className="block h-[3px] w-[9px] rounded-full bg-current opacity-40" />
      </span>
    </Plate>
  );
}

export function RatingArt() {
  return (
    <Plate>
      <span className="flex items-end gap-[3px]">
        {[7, 12, 17, 10].map((h, i) => (
          <span
            key={i}
            className="block w-[3px] rounded-full bg-current"
            style={{ height: h, opacity: i === 2 ? 1 : 0.45 }}
          />
        ))}
      </span>
    </Plate>
  );
}

export function CardsArt() {
  return (
    <Plate>
      <span className="relative block h-[20px] w-[22px]">
        <span className="absolute inset-y-0 start-0 block w-[13px] rounded-[3px] bg-current opacity-35" />
        <span className="absolute inset-y-[2px] start-[7px] block w-[13px] rounded-[3px] bg-current" />
      </span>
    </Plate>
  );
}

export function CommentArt() {
  return (
    <Plate>
      <span className="relative block h-[17px] w-[20px] rounded-[4px] bg-current">
        <span className="absolute -bottom-[4px] start-[4px] block h-0 w-0 border-e-[6px] border-t-[5px] border-e-transparent border-t-current" />
      </span>
    </Plate>
  );
}

export function ListArt() {
  return (
    <Plate>
      <span className="flex flex-col gap-[4px]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex items-center gap-[4px]">
            <span className="block h-[4px] w-[4px] rounded-full bg-current" />
            <span
              className="block h-[3px] rounded-full bg-current"
              style={{ width: 14 - i * 3, opacity: 0.55 }}
            />
          </span>
        ))}
      </span>
    </Plate>
  );
}
