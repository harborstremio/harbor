-- The Sports Branding API: a read-only layer over the JL Vision branding tables
-- (sports_team_logos, football_logo_groups, team_brand_themes, design_templates,
-- design_projects, generated_design_assets) for the Sports Hub.
--
-- The app reads only the `media.sports_*` views below, with the viewer's own session; every
-- view runs as the caller (security_invoker), so the tables' row-level security still decides
-- what each viewer sees. No service-role key is involved anywhere.
--
-- Two tables are added:
--   sports_team_provider_ids  maps a sports-data provider's team id (ESPN today) to a JL Vision
--                             team, so games are matched by id, never by name.
--   sports_art_publications   artwork approved for every Sports Hub viewer. Rows are written from
--                             the Supabase dashboard only (no client write policy), after the
--                             art, logo and trademark permissions are checked.

-- Provider team ids ---------------------------------------------------------------------------

create table if not exists public.sports_team_provider_ids (
  id uuid primary key default gen_random_uuid(),
  conference text not null,
  sport text not null,
  team_slug text not null,
  provider text not null check (provider ~ '^[a-z0-9-]{2,24}$'),
  provider_league text not null check (provider_league ~ '^[a-z0-9-]{2,40}$'),
  provider_team_id text not null check (provider_team_id ~ '^[A-Za-z0-9._-]{1,40}$'),
  created_at timestamptz not null default now(),
  unique (provider, provider_league, provider_team_id),
  unique (conference, sport, team_slug, provider, provider_league),
  foreign key (conference, sport, team_slug)
    references public.sports_team_logos (conference, sport, team_slug)
    on update cascade on delete cascade
);
alter table public.sports_team_provider_ids enable row level security;
drop policy if exists sports_team_provider_ids_read on public.sports_team_provider_ids;
create policy sports_team_provider_ids_read on public.sports_team_provider_ids
  for select to authenticated using (true);
grant select on public.sports_team_provider_ids to authenticated;

-- Teams that already carry an ESPN id.
insert into public.sports_team_provider_ids (conference, sport, team_slug, provider, provider_league, provider_team_id)
select t.conference, t.sport, t.team_slug, 'espn',
       case when g.league = 'nfl' then 'nfl' else 'college-football' end,
       t.espn_team_id::text
from public.sports_team_logos t
join public.football_logo_groups g on g.slug = t.conference
where t.espn_team_id is not null
on conflict do nothing;

-- NFL teams (ESPN's NFL team ids).
insert into public.sports_team_provider_ids (conference, sport, team_slug, provider, provider_league, provider_team_id)
select t.conference, t.sport, t.team_slug, 'espn', 'nfl', v.id
from (values
  ('atlanta-falcons','1'), ('buffalo-bills','2'), ('chicago-bears','3'), ('cincinnati-bengals','4'),
  ('cleveland-browns','5'), ('dallas-cowboys','6'), ('denver-broncos','7'), ('detroit-lions','8'),
  ('green-bay-packers','9'), ('tennessee-titans','10'), ('indianapolis-colts','11'),
  ('kansas-city-chiefs','12'), ('las-vegas-raiders','13'), ('los-angeles-rams','14'),
  ('miami-dolphins','15'), ('minnesota-vikings','16'), ('new-england-patriots','17'),
  ('new-orleans-saints','18'), ('new-york-giants','19'), ('new-york-jets','20'),
  ('philadelphia-eagles','21'), ('arizona-cardinals','22'), ('pittsburgh-steelers','23'),
  ('los-angeles-chargers','24'), ('san-francisco-49ers','25'), ('seattle-seahawks','26'),
  ('tampa-bay-buccaneers','27'), ('washington-commanders','28'), ('carolina-panthers','29'),
  ('jacksonville-jaguars','30'), ('baltimore-ravens','33'), ('houston-texans','34')
) as v(slug, id)
join public.sports_team_logos t on t.team_slug = v.slug and t.conference like 'nfl-%'
on conflict do nothing;

-- Shared (published) artwork ------------------------------------------------------------------

create table if not exists public.sports_art_publications (
  id uuid primary key default gen_random_uuid(),
  conference text not null,
  sport text not null,
  team_slug text not null,
  slot text not null check (slot in ('hero','wordmark','story','card','wallpaper')),
  storage_path text not null unique check (storage_path ~ '^published/[A-Za-z0-9._/-]{1,200}$'),
  title text,
  licensing_confirmed boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (conference, sport, team_slug)
    references public.sports_team_logos (conference, sport, team_slug)
    on update cascade on delete cascade
);
alter table public.sports_art_publications enable row level security;
drop policy if exists sports_art_publications_read on public.sports_art_publications;
create policy sports_art_publications_read on public.sports_art_publications
  for select to authenticated using (approved_at is not null and licensing_confirmed);
grant select on public.sports_art_publications to authenticated;

-- Only files behind an approved publication are readable under published/.
drop policy if exists media_art_published_read on storage.objects;
create policy media_art_published_read on storage.objects
  for select to authenticated using (
    bucket_id = 'media-art'
    and (storage.foldername(name))[1] = 'published'
    and exists (
      select 1 from public.sports_art_publications p
      where p.storage_path = objects.name and p.approved_at is not null and p.licensing_confirmed
    )
  );

-- The API views ---------------------------------------------------------------------------------

create or replace view media.sports_groups with (security_invoker = true) as
select slug, name, league, group_type, parent_slug, season
from public.football_logo_groups;

-- One row per team. logo_path is set only for an approved, licensed or owned logo file.
create or replace view media.sports_teams with (security_invoker = true) as
select t.conference, t.sport, t.team_slug, t.team_name, t.mascot, g.league,
       case when t.asset_status = 'approved' and t.licensing_status in ('licensed','owned')
            then t.storage_path end as logo_path,
       coalesce(
         (select jsonb_agg(jsonb_build_object('provider', p.provider, 'league', p.provider_league, 'id', p.provider_team_id))
            from public.sports_team_provider_ids p
           where p.conference = t.conference and p.sport = t.sport and p.team_slug = t.team_slug),
         '[]'::jsonb) as provider_ids
from public.sports_team_logos t
join public.football_logo_groups g on g.slug = t.conference;

-- Verified palettes only; the default theme first.
create or replace view media.sports_team_themes with (security_invoker = true) as
select conference_slug as conference, sport, team_slug, theme_name, style_family,
       primary_hex, secondary_hex, accent_hex, gradient_start_hex, gradient_end_hex, glow_hex,
       background_hex, text_dark_hex, text_light_hex, glass_blur_px, glass_opacity, is_default
from public.team_brand_themes
where is_verified;

create or replace view media.sports_templates with (security_invoker = true) as
select template_slug, template_name, template_type, style_family, aspect_ratio,
       canvas_width, canvas_height, sort_order, layout_json
from public.design_templates
where is_active;

create or replace view media.sports_published_art with (security_invoker = true) as
select conference, sport, team_slug, slot, storage_path, title
from public.sports_art_publications
where approved_at is not null and licensing_confirmed;

-- The viewer's own finished artwork (RLS on both tables limits it to their rows).
create or replace view media.sports_my_artwork with (security_invoker = true) as
select p.conference_slug as conference, p.sport, p.team_slug,
       case a.asset_kind when 'hero' then 'hero' when 'card' then 'card'
                         when 'background' then 'wallpaper' when 'poster' then 'story' end as slot,
       a.storage_path, a.is_primary, a.created_at
from public.generated_design_assets a
join public.design_projects p on p.id = a.project_id and p.user_id = a.user_id
where a.storage_bucket = 'media-art'
  and a.asset_kind in ('hero','card','background','poster')
  and p.team_slug is not null and p.conference_slug is not null;

grant select on media.sports_groups, media.sports_teams, media.sports_team_themes,
  media.sports_templates, media.sports_published_art, media.sports_my_artwork to authenticated;
