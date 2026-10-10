import { readArtworkChoices } from './lib/custom-artwork-store';
import { mountCustomArtwork } from './lib/custom-artwork-render';

// The inline poster covers the interval before this module can be parsed.
const host = document.getElementById('harbor-custom-boot-art');
const choice = readArtworkChoices().launch;
if (host && choice) {
  const original = host.previousElementSibling as HTMLElement | null;
  let cleanup = () => {};
  const observer = new MutationObserver(() => {
    if (!host.isConnected) { cleanup(); observer.disconnect(); }
  });
  cleanup = mountCustomArtwork(host, choice, () => {
    cleanup(); observer.disconnect(); host.remove();
    if (original) original.style.removeProperty('display');
  });
  observer.observe(document.body, {childList:true,subtree:true});
}
