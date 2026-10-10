-- Sports art slots for media.custom_art (JL Media Vision "Sports art" settings).
--
-- 0001 limited `kind` to team/player/channel/wallpaper, one row per subject. The app now keeps
-- five slots per subject: `ref_id` names the subject ("team:<league>:<espnTeamId>",
-- "athlete:<league>:<espnId>", "college:<id>") and `kind` the slot. Older team/player rows stay
-- valid and are read as the hero slot. The unique (owner, kind, ref_id) key from 0001 already
-- gives one row per slot.
--
-- Row-level security is unchanged: custom_art_own (0001) limits every row to its owner, and the
-- media_art_* storage policies (0001) limit the private bucket to the owner's own folder
-- (<owner>/<ref>/<kind>.<ext>). Nothing here widens access.

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'media' and rel.relname = 'custom_art' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%kind%'
  loop
    execute format('alter table media.custom_art drop constraint %I', c.conname);
  end loop;
end $$;

alter table media.custom_art
  add constraint custom_art_kind_check
  check (kind in ('team', 'player', 'channel', 'wallpaper', 'hero', 'wordmark', 'story', 'card'));

alter table media.custom_art
  add constraint custom_art_ref_id_check
  check (ref_id ~ '^(team|athlete):[a-z0-9-]{1,24}:[A-Za-z0-9._-]{1,40}$'
      or ref_id ~ '^college:[A-Za-z0-9._:-]{1,60}$'
      or kind in ('channel', 'wallpaper')) not valid;

create index if not exists custom_art_owner_idx on media.custom_art (owner);

-- A 3840x2160 hero or wallpaper is often over 5 MB as PNG; allow up to 15 MB (the app checks
-- the same limit before uploading).
update storage.buckets set file_size_limit = 15728640 where id = 'media-art';
