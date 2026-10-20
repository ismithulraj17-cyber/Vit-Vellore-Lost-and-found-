-- VIT Lost & Found: database schema and no-auth public API.
-- Contact details live in a private schema and are returned only when shared.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.lost_found_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 100),
  category text not null,
  location text not null,
  building text not null,
  floor text not null default 'Floor not provided',
  landmark text not null default '',
  lat double precision not null,
  lng double precision not null,
  status text not null check (status in ('lost', 'found')),
  date date not null default current_date,
  "time" text not null default 'Time not provided',
  description text not null check (char_length(description) between 5 and 1000),
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.lost_found_reports
  add column if not exists "time" text not null default 'Time not provided';

create table if not exists private.report_contacts (
  report_id uuid primary key references public.lost_found_reports(id) on delete cascade,
  owner text not null default '',
  phone text not null default '',
  contact text not null default '',
  share_contact boolean not null default false
);

alter table public.lost_found_reports enable row level security;
alter table private.report_contacts enable row level security;
revoke all on public.lost_found_reports from anon, authenticated;
revoke all on private.report_contacts from anon, authenticated, public;

drop function if exists public.list_lost_found_reports();
create function public.list_lost_found_reports()
returns table (
  id uuid, title text, category text, location text, building text, floor text,
  landmark text, lat double precision, lng double precision, status text,
  date date, "time" text, description text, image_url text, owner text, phone text,
  contact text, share_contact boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.title, r.category, r.location, r.building, r.floor,
         r.landmark, r.lat, r.lng, r.status, r.date, r."time", r.description, r.image_url,
         case when c.share_contact then c.owner else '' end,
         case when c.share_contact then c.phone else '' end,
         case when c.share_contact then c.contact else '' end,
         coalesce(c.share_contact, false)
  from public.lost_found_reports as r
  left join private.report_contacts as c on c.report_id = r.id
  order by r.created_at desc;
$$;

create or replace function public.create_lost_found_report(report jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_report_id uuid;
begin
  if nullif(trim(report->>'title'), '') is null
     or nullif(trim(report->>'description'), '') is null
     or nullif(trim(report->>'location'), '') is null then
    raise exception 'Title, description, and location are required';
  end if;
  if report->>'status' not in ('lost', 'found') then
    raise exception 'Status must be lost or found';
  end if;
  if char_length(report->>'title') > 100 or char_length(report->>'description') > 1000 then
    raise exception 'Report text is too long';
  end if;

  insert into public.lost_found_reports (
    title, category, location, building, floor, landmark, lat, lng,
    status, date, "time", description, image_url
  ) values (
    trim(report->>'title'), left(coalesce(report->>'category', 'Personal'), 40),
    trim(report->>'location'), coalesce(nullif(trim(report->>'building'), ''), trim(report->>'location')),
    coalesce(nullif(trim(report->>'floor'), ''), 'Floor not provided'),
    left(coalesce(report->>'landmark', ''), 160),
    (report->>'lat')::double precision, (report->>'lng')::double precision,
    report->>'status', coalesce(nullif(report->>'date', '')::date, current_date),
    coalesce(nullif(trim(report->>'time'), ''), 'Time not provided'),
    trim(report->>'description'), nullif(report->>'image_url', '')
  ) returning id into new_report_id;

  insert into private.report_contacts (report_id, owner, phone, contact, share_contact)
  values (
    new_report_id, left(coalesce(report->>'owner', ''), 100),
    left(coalesce(report->>'phone', ''), 24), left(coalesce(report->>'contact', ''), 254),
    coalesce((report->>'share_contact')::boolean, false)
  );
  return new_report_id;
end;
$$;

revoke all on function public.list_lost_found_reports() from public, authenticated;
revoke all on function public.create_lost_found_report(jsonb) from public, authenticated;
grant execute on function public.list_lost_found_reports() to anon;
grant execute on function public.create_lost_found_report(jsonb) to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-images', 'report-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view lost and found photos" on storage.objects;

drop policy if exists "Visitors can upload lost and found photos" on storage.objects;
create policy "Visitors can upload lost and found photos"
on storage.objects for insert to anon
with check (bucket_id = 'report-images');
