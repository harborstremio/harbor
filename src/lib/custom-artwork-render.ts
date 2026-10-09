import type { AnimationItem } from 'lottie-web';
import { validateArtworkLottie, type ArtworkChoice } from './custom-artwork-data';
import { loadArtworkBlob } from './custom-artwork-store';

/** Shared by the pre-React splash and every in-app artwork surface. */
export function mountCustomArtwork(host: HTMLElement, choice: ArtworkChoice, onError: () => void) {
  let disposed = false, visible = true, ready = false;
  let animation: AnimationItem | undefined, objectUrl: string | undefined;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const poster = document.createElement('img');
  poster.src = choice.poster; poster.alt = ''; poster.draggable = false;
  poster.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain';
  const content = document.createElement('div');
  content.style.cssText = 'position:absolute;inset:0;visibility:hidden';
  host.replaceChildren(poster, content);
  let image: HTMLImageElement | undefined;
  const update = () => {
    if (disposed) return;
    const play = ready && visible && !document.hidden && !motion.matches;
    content.style.visibility = play ? 'visible' : 'hidden';
    poster.style.visibility = play ? 'hidden' : 'visible';
    if (animation) { if (play) animation.play(); else animation.pause(); }
    if (image && objectUrl) {
      const src = play ? objectUrl : choice.poster;
      if (image.src !== src) image.src = src;
    }
  };
  const observer = new IntersectionObserver(entries => { visible = entries.some(e=>e.isIntersecting); update(); });
  observer.observe(host);
  document.addEventListener('visibilitychange', update);
  motion.addEventListener('change', update);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fail = () => { if (!disposed) { clearTimeout(timer); onError(); } };
  void (async () => {
    const blob = await loadArtworkBlob(choice.id);
    if (disposed) return;
    if (choice.kind === 'image') {
      objectUrl = URL.createObjectURL(blob);
      image = document.createElement('img'); image.alt = ''; image.draggable = false;
      image.style.cssText = 'width:100%;height:100%;object-fit:contain';
      image.onerror = fail;
      image.onload = () => { ready = true; update(); };
      content.append(image); image.src = objectUrl;
    } else {
      const data = validateArtworkLottie(JSON.parse(await blob.text()));
      // The light build does not execute uploaded Lottie expressions.
      const { default: lottie } = await import('lottie-web/build/player/lottie_light');
      if (disposed) return;
      animation = lottie.loadAnimation({container:content,renderer:'svg',loop:true,autoplay:false,animationData:data,rendererSettings:{preserveAspectRatio:'xMidYMid meet'}});
      const loaded = () => { clearTimeout(timer); ready = true; update(); };
      timer = setTimeout(fail, 8000);
      animation.addEventListener('DOMLoaded', loaded);
      animation.addEventListener('data_failed', fail);
      animation.addEventListener('error', fail);
      if (animation.isLoaded) loaded();
    }
  })().catch(fail);
  return () => {
    disposed = true; clearTimeout(timer); observer.disconnect();
    document.removeEventListener('visibilitychange', update); motion.removeEventListener('change', update);
    if (image) { image.onload = image.onerror = null; image.removeAttribute('src'); }
    animation?.destroy(); if (objectUrl) URL.revokeObjectURL(objectUrl); host.replaceChildren();
  };
}
