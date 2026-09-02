import type { MediaServerProvider } from "@/lib/media-server/types";

export function mediaServerProviderName(provider: MediaServerProvider): string {
  if (provider === "plex") return "Plex";
  if (provider === "emby") return "Emby";
  return "Jellyfin";
}

export function MediaServerBrand({
  provider,
  name,
  compact = false,
}: {
  provider: MediaServerProvider;
  name: string;
  compact?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <ProviderMark provider={provider} />
      {!compact && <span className="truncate">{name}</span>}
    </span>
  );
}

function ProviderMark({ provider }: { provider: MediaServerProvider }) {
  if (provider === "plex")
    return (
      <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0">
        <path fill="#e5a00d" d="M7 2h6.2L21 12l-7.8 10H7l7.8-10z" />
      </svg>
    );
  if (provider === "emby")
    return (
      <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0">
        <path fill="#52b54b" d="m12 1 9.5 5.5v11L12 23l-9.5-5.5v-11z" />
        <path fill="white" d="m9 7 7 5-7 5z" />
      </svg>
    );
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0">
      <path fill="#aa5cc3" d="M12 2 23 21H1z" />
      <path fill="#171717" d="m12 8 5.2 9H6.8z" />
      <path fill="#aa5cc3" d="m12 12.1 2.8 4.9H9.2z" />
    </svg>
  );
}
