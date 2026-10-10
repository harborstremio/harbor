import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMusicNavigate } from "./music-navigate";
import { loadArtistEntities } from "@/lib/music/artist-entities";
import { requestMusicGenre, requestMusicLabel, requestMusicSearch } from "@/lib/music/navigation";
import type { MusicArtistProfile } from "@/lib/music/artist-profile";
import "./music-linked-bio.css";

type Entity = { text: string; run: () => void };

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function linkedBioParts(
  body: string,
  entities: readonly Entity[],
): (string | { text: string; at: number })[] {
  const ranked = entities
    .map((entity, at) => ({ text: entity.text.trim(), at }))
    .filter((entity) => entity.text.length > 2)
    .sort((left, right) => right.text.length - left.text.length);
  if (!ranked.length || !body) return [body];

  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${ranked.map((entity) => escape(entity.text)).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  const out: (string | { text: string; at: number })[] = [];
  const used = new Set<number>();
  let last = 0;
  for (const match of body.matchAll(pattern)) {
    const found = match[0];
    const hit = ranked.find((entity) => entity.text.toLowerCase() === found.toLowerCase());
    if (!hit || used.has(hit.at)) continue;
    const at = hit.at;
    used.add(at);
    const start = match.index ?? 0;
    if (start > last) out.push(body.slice(last, start));
    out.push({ text: found, at });
    last = start + found.length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

export function MusicLinkedBio({
  body,
  profile,
  className = "",
}: {
  body: string;
  profile: MusicArtistProfile;
  className?: string;
}) {
  const { goToArtist } = useMusicNavigate();
  const [extra, setExtra] = useState<Entity[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    void loadArtistEntities(profile.id, controller.signal)
      .then((found) => {
        if (controller.signal.aborted) return;
        setExtra([
          ...found.labels.map((label) => ({
            text: label.name,
            run: () => requestMusicLabel(label.id, label.name),
          })),
          ...found.releases.map((title) => ({
            text: title,
            run: () => requestMusicSearch(`${profile.name} ${title}`),
          })),
        ]);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [profile.id, profile.name]);

  const entities = useMemo<Entity[]>(
    () => [
      ...profile.members.map((member) => ({
        text: member.name,
        run: () => goToArtist(member.name),
      })),
      ...extra,
      ...profile.genres.map((genre) => ({ text: genre, run: () => requestMusicGenre(genre) })),
    ],
    [profile.members, profile.genres, extra, goToArtist],
  );

  const parts = useMemo(() => linkedBioParts(body, entities), [body, entities]);

  return (
    <>
      {parts.map((part, index): ReactNode =>
        typeof part === "string" ? (
          part
        ) : (
          <button
            key={`${part.at}:${index}`}
            type="button"
            className={`music-linked-bio-link ${className}`}
            onClick={() => entities[part.at]?.run()}
          >
            {part.text}
          </button>
        ),
      )}
    </>
  );
}
