import { musicGenreName } from "@/lib/music/genre-catalog";
import { useEffect, useMemo, useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { Check, Search, X } from "@/components/icons/music-icons";
import { MusicDiscoveryIcon } from "@/components/music/music-discovery-icon";
import { useT, useUiLanguage } from "@/lib/i18n";
import { MUSIC_GENRES, MUSIC_GENRE_COUNTRIES, MUSIC_GENRE_FAMILIES, filterMusicGenres, type MusicDiscoveryGenre } from "@/lib/music/genre-catalog";
import { readMusicPreference, writeMusicPreference } from "@/lib/music/preferences";
import { MUSIC_GENRE_ARTWORK } from "@/lib/music/genre-artwork";
import "./music-genre-browser.css";

type Filters = { query: string; countries: string[]; family: string };
const defaults: Filters = { query: "", countries: [], family: "" };
function readFilters(mode: string): Filters {
  try {
    const stored = JSON.parse(readMusicPreference(`harbor.music.genres.${mode}.v1`) ?? "null");
    if (!stored) return defaults;
    return { query: typeof stored.query === "string" ? stored.query.slice(0, 120) : "",
      countries: Array.isArray(stored.countries) ? stored.countries.filter((code: string) => MUSIC_GENRE_COUNTRIES.includes(code)) : [],
      family: MUSIC_GENRE_FAMILIES.includes(stored.family) ? stored.family : "" };
  } catch { return defaults; }
}

export function MusicGenreBrowser({ mode = "explore", selected, onSelect }: {
  mode?: "explore" | "tastes";
  selected?: readonly number[];
  onSelect: (genre: MusicDiscoveryGenre) => void;
}) {
  const t = useT(), language = useUiLanguage();
  const [filters, setFilters] = useState(() => readFilters(mode));
  const [selectedOnly, setSelectedOnly] = useState(false);
  const regions = useMemo(() => new Intl.DisplayNames([language], { type: "region" }), [language]);
  const countryName = (code: string) => regions.of(code) ?? code;
  const countries = [...MUSIC_GENRE_COUNTRIES].sort((a, b) => countryName(a).localeCompare(countryName(b), language));
  useEffect(() => writeMusicPreference(`harbor.music.genres.${mode}.v1`, JSON.stringify(filters)), [filters, mode]);
  const filtered = filterMusicGenres(MUSIC_GENRES, filters.query, filters.countries, filters.family, countryName, genre => musicGenreName(genre, t))
    .filter(genre => !selectedOnly || selected?.includes(genre.id));
  const change = (patch: Partial<Filters>) => setFilters(previous => ({ ...previous, ...patch }));
  const isFiltered = filters.query || filters.countries.length || filters.family || selectedOnly;
  return (
    <section className="music-genre-browser" aria-label={t("music.explore.genres")}>
      <div className="music-genre-toolbar">
        <label className="music-genre-search">
          <Search size={18} aria-hidden />
          <input type="search" value={filters.query} placeholder={t("music.taste.search")}
            aria-label={t("music.taste.search")} onChange={event => change({ query: event.target.value })} />
        </label>
        <Dropdown value={filters.countries.length === 1 ? filters.countries[0] : filters.countries.length ? "multiple" : ""}
          placeholder={t("music.explore.countryCount", { count: filters.countries.length })}
          ariaLabel={t("music.explore.countries")}
          options={[{ value: "", label: t("music.explore.allCountries") }, ...countries.map(code => ({ value: code, label: countryName(code), left: filters.countries.includes(code) ? <Check size={14} /> : undefined }))]}
          onChange={code => change({ countries: !code ? [] : filters.countries.includes(code) ? filters.countries.filter(item => item !== code) : [...filters.countries, code] })} />
        <Dropdown value={filters.family} ariaLabel={t("music.explore.styles")}
          options={[{ value: "", label: t("music.explore.allStyles") }, ...MUSIC_GENRE_FAMILIES.map(family => ({ value: family, label: t(`music.explore.family.${family}`) }))]}
          onChange={family => change({ family })} />
        {selected && <button type="button" className="music-genre-selected" aria-pressed={selectedOnly} onClick={() => setSelectedOnly(value => !value)}>{t("music.taste.selected", { count: selected.length })}</button>}
      </div>
      <div className="music-genre-filter-summary">
        <span aria-live="polite">{t("music.explore.genreCount", { count: filtered.length })}</span>
        {filters.countries.map(code => <button type="button" key={code} aria-label={t("music.explore.removeCountry", { country: countryName(code) })}
          onClick={() => change({ countries: filters.countries.filter(item => item !== code) })}>{countryName(code)}<X size={13} aria-hidden /></button>)}
        {!!isFiltered && <button type="button" onClick={() => { setFilters(defaults); setSelectedOnly(false); }}>{t("music.explore.reset")}</button>}
      </div>
      <div className="music-genre-grid">
        {filtered.map(genre => <button key={genre.id} type="button" data-music-genre={genre.id}
          aria-pressed={selected ? selected.includes(genre.id) : undefined} onClick={() => onSelect(genre)}>
          <img src={MUSIC_GENRE_ARTWORK[genre.id]} alt="" loading="lazy" decoding="async"/>
          <MusicDiscoveryIcon genreId={genre.id} />
          <span className="music-genre-copy"><strong>{musicGenreName(genre, t)}</strong><small>{genre.countries.length ? genre.countries.slice(0, 2).map(countryName).join(" · ") : t("music.explore.global")}</small></span>
          {selected && <span className="music-genre-check">{selected.includes(genre.id) && <Check size={15} aria-hidden />}</span>}
        </button>)}
      </div>
      {!filtered.length && <p className="music-genre-empty">{t("music.explore.noGenres")}</p>}
    </section>
  );
}
