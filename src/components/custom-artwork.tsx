import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { ArtworkChoice, ArtworkRole } from '@/lib/custom-artwork-data';
import { readArtworkChoices, subscribeArtwork } from '@/lib/custom-artwork-store';
import { mountCustomArtwork } from '@/lib/custom-artwork-render';

export function useCustomArtwork(role: ArtworkRole) {
  return useSyncExternalStore(subscribeArtwork, readArtworkChoices, readArtworkChoices)[role];
}

function Artwork({ choice, className, fallback }: {choice:ArtworkChoice;className?:string;fallback?:ReactNode}) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!host.current || failed) return;
    return mountCustomArtwork(host.current, choice, () => setFailed(true));
  }, [choice, failed]);
  if (failed) return fallback;
  return <div ref={host} className={className} style={{position:'relative',flexShrink:0}} aria-hidden="true" data-custom-artwork={choice.id} />;
}

export function CustomArtwork({ role, className, fallback = null }: {role:ArtworkRole;className?:string;fallback?:ReactNode}) {
  const choice = useCustomArtwork(role);
  return choice ? <Artwork key={choice.id} choice={choice} className={className} fallback={fallback} /> : fallback;
}
