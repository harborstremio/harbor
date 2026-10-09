import { MediaStartPage } from "@/components/media-start-page";

export function EBookSetup({ onSetup }: { onSetup: () => void }) {
  return <main data-ebook-page className="media-start-scroll pt-24"><MediaStartPage kind="ebook" onSetup={onSetup}/></main>;
}
