-- JL Media Vision account data, kept in its own `media` schema inside the JL Vision project so
-- the coaching tables in `public` are untouched. Every row belongs to one signed-in account.

create schema if not exists media;
grant usage on schema media to authenticated, service_role;

create or replace function media.touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Viewer profiles ("Who's watching?") under one account.
create table if not exists media.profiles (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  avatar text,
  is_kid boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_owner_idx on media.profiles (owner);
create trigger profiles_touch before update on media.profiles for each row execute function media.touch();

create or replace function media.owns_profile(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from media.profiles p where p.id = pid and p.owner = (select auth.uid()));
$$;
revoke all on function media.owns_profile(uuid) from public, anon;
grant execute on function media.owns_profile(uuid) to authenticated;

-- Favorites and watchlist share a shape: kind is channel, movie, series, team, player or track.
create table if not exists media.favorites (
  profile_id uuid not null references media.profiles (id) on delete cascade,
  kind text not null,
  item_id text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (profile_id, kind, item_id)
);

create table if not exists media.watchlist (
  profile_id uuid not null references media.profiles (id) on delete cascade,
  kind text not null,
  item_id text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (profile_id, kind, item_id)
);

-- Resume points, synced so "Continue watching" follows the viewer between devices.
create table if not exists media.progress (
  profile_id uuid not null references media.profiles (id) on delete cascade,
  item_id text not null,
  kind text not null,
  position_ms bigint not null default 0,
  duration_ms bigint,
  finished boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (profile_id, item_id)
);
create index if not exists progress_recent_idx on media.progress (profile_id, updated_at desc);
create trigger progress_touch before update on media.progress for each row execute function media.touch();

-- Custom team and player art. Files live in the private `media-art` bucket under <owner>/.
create table if not exists media.custom_art (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('team', 'player', 'channel', 'wallpaper')),
  ref_id text not null,
  label text,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (owner, kind, ref_id)
);

-- Subscription tracking (renewal reminders and savings). Nothing here charges anyone.
create table if not exists media.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  category text,
  price_cents integer check (price_cents >= 0),
  currency text not null default 'USD',
  cycle text not null default 'monthly' check (cycle in ('weekly', 'monthly', 'quarterly', 'yearly', 'once')),
  renews_on date,
  remind_days smallint not null default 3,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_owner_idx on media.subscriptions (owner, renews_on);
create trigger subscriptions_touch before update on media.subscriptions for each row execute function media.touch();

-- Service keys (Real-Debrid, TorBox, TMDB, Trakt, sports keys, IPTV logins). Stored encrypted
-- with a key that lives only in Vault; readable only through the functions below, by the owner.
create table if not exists media.secrets (
  owner uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 64),
  ciphertext bytea not null,
  updated_at timestamptz not null default now(),
  primary key (owner, name)
);

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'jl_media_secrets_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'jl_media_secrets_key',
      'Encrypts media.secrets. Rotating it makes stored keys unreadable.');
  end if;
end $$;

create or replace function media.set_secret(p_name text, p_value text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  k text := (select decrypted_secret from vault.decrypted_secrets where name = 'jl_media_secrets_key');
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_value is null or p_value = '' then
    delete from media.secrets where owner = uid and name = p_name;
    return;
  end if;
  insert into media.secrets (owner, name, ciphertext, updated_at)
  values (uid, p_name, extensions.pgp_sym_encrypt(p_value, k), now())
  on conflict (owner, name) do update set ciphertext = excluded.ciphertext, updated_at = now();
end $$;

create or replace function media.get_secrets() returns table (name text, value text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.name,
         extensions.pgp_sym_decrypt(s.ciphertext,
           (select decrypted_secret from vault.decrypted_secrets where name = 'jl_media_secrets_key')),
         s.updated_at
  from media.secrets s
  where s.owner = (select auth.uid());
$$;

revoke all on function media.set_secret(text, text) from public, anon;
revoke all on function media.get_secrets() from public, anon;
grant execute on function media.set_secret(text, text) to authenticated;
grant execute on function media.get_secrets() to authenticated;

-- Row-level security: an account sees only its own rows.
alter table media.profiles enable row level security;
alter table media.favorites enable row level security;
alter table media.watchlist enable row level security;
alter table media.progress enable row level security;
alter table media.custom_art enable row level security;
alter table media.subscriptions enable row level security;
alter table media.secrets enable row level security;

create policy profiles_own on media.profiles for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy favorites_own on media.favorites for all to authenticated
  using (media.owns_profile(profile_id)) with check (media.owns_profile(profile_id));
create policy watchlist_own on media.watchlist for all to authenticated
  using (media.owns_profile(profile_id)) with check (media.owns_profile(profile_id));
create policy progress_own on media.progress for all to authenticated
  using (media.owns_profile(profile_id)) with check (media.owns_profile(profile_id));
create policy custom_art_own on media.custom_art for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy subscriptions_own on media.subscriptions for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
-- media.secrets has no policies on purpose: it is reached only through set_secret/get_secrets.

grant select, insert, update, delete on media.profiles, media.favorites, media.watchlist, media.progress,
  media.custom_art, media.subscriptions to authenticated;
revoke all on media.secrets from anon, authenticated;
grant all on all tables in schema media to service_role;

-- Custom art bucket: private, each account writes only inside its own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media-art', 'media-art', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy media_art_read on storage.objects for select to authenticated
  using (bucket_id = 'media-art' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_art_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media-art' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_art_update on storage.objects for update to authenticated
  using (bucket_id = 'media-art' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_art_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media-art' and (storage.foldername(name))[1] = (select auth.uid())::text);
