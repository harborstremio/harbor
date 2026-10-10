import { createRoot } from 'react-dom/client';
import { GameRetroPopout } from '@/views/games/game-retro-popout';
import { hydrateCustomThemes } from '@/lib/custom-themes';
import { applyTheme } from '@/lib/theme';
import { loadStoredSettings } from '@/lib/settings/load';
import { getUiLanguage } from '@/lib/i18n/store';
import { ensureUiLocale } from '@/lib/i18n/load-locale';
import '@/index.css';

async function mount() {
  await Promise.all([hydrateCustomThemes().catch(() => {}), ensureUiLocale(getUiLanguage())]);
  applyTheme(loadStoredSettings().theme);
  createRoot(document.getElementById('root')!).render(<GameRetroPopout/>);
  // Font providers must never delay opening a local game window.
  for (const href of [
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap',
    'https://api.fontshare.com/v2/css?f[]=sentient@400,500,600,700&f[]=switzer@400,500,600,700&f[]=general-sans@400,500,600,700&display=swap',
  ]) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; document.head.append(link); }
}
void mount();
