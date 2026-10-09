import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, RotateCcw, Upload } from 'lucide-react';
import { CustomArtwork, useCustomArtwork } from '@/components/custom-artwork';
import { HarborLoader } from '@/components/harbor-loader';
import { HarborMark } from '@/components/icons/harbor-mark';
import { ARTWORK_ACCEPT, type ArtworkRole } from '@/lib/custom-artwork-data';
import { importArtwork } from '@/lib/custom-artwork-import';
import { saveArtwork } from '@/lib/custom-artwork-store';
import { useT } from '@/lib/i18n';
import { Section } from '../shared';
import { SettingRow } from '../kit';
import './startup-artwork.css';

function ArtworkSetting({role}: {role:ArtworkRole}) {
  const t = useT(), choice = useCustomArtwork(role);
  const file = useRef<HTMLInputElement>(null), alive = useRef(true), pending = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { alive.current = true; return () => {alive.current = false;}; }, []);
  async function change(next?: File) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const imported = next ? await importArtwork(next) : null;
      if (!alive.current) return;
      await saveArtwork(role, imported?.choice ?? null, imported?.blob);
    } catch (err) {
      if (alive.current) setError(err instanceof Error && ['large','external','storage'].includes(err.message) ? err.message : 'invalid');
    } finally {
      pending.current = false; if (alive.current) setBusy(false);
    }
  }
  return <SettingRow wide label={t(`artwork.${role}`)} desc={t(`artwork.${role}Hint`)}>
    <div className="hset-artwork" aria-busy={busy}>
      <div className="hset-artwork-preview">
        <CustomArtwork role={role} className="h-24 w-24" fallback={role === 'loading' ? <HarborLoader size="sm" original /> : <HarborMark className="h-16 w-16 text-ink" />} />
      </div>
      <div className="hset-artwork-controls">
        <span className="hset-artwork-name" title={choice?.name}>{choice?.name ?? t('artwork.original')}</span>
        <div className="hset-artwork-actions">
          <button type="button" disabled={busy} onClick={()=>file.current?.click()} aria-label={t(role==='loading'?'artwork.chooseLoading':'artwork.chooseLaunch')}>
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}{t(busy?'artwork.saving':'artwork.choose')}
          </button>
          {choice && <button type="button" disabled={busy} onClick={()=>void change()} aria-label={t(role==='loading'?'artwork.resetLoading':'artwork.resetLaunch')}><RotateCcw size={15} />{t('artwork.reset')}</button>}
        </div>
        <input ref={file} type="file" accept={ARTWORK_ACCEPT} hidden onChange={event=>{const picked=event.currentTarget.files?.[0];event.currentTarget.value='';if(picked)void change(picked);}} />
        {busy && <span className="sr-only" role="status">{t('artwork.saving')}</span>}
        {error && <p className="hset-artwork-error" role="alert">{t(`artwork.error.${error}`)}</p>}
      </div>
    </div>
  </SettingRow>;
}

export function StartupArtworkSettings() {
  const t = useT();
  return <Section title={t('artwork.title')} subtitle={t('artwork.hint')}>
    <ArtworkSetting role="loading" />
    <ArtworkSetting role="launch" />
    <p className="mt-3 text-[12px] leading-relaxed text-ink-subtle">{t('artwork.local')}</p>
  </Section>;
}
