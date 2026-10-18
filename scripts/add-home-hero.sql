-- Custom video + title for the home page hero (independent of launches).
create table if not exists home_hero (
  id int primary key,
  enabled boolean not null default false,
  title text,
  video text,
  image text,
  date_label text,
  button_text text,
  button_url text
);
insert into home_hero (id) values (1) on conflict (id) do nothing;

alter table home_hero enable row level security;
drop policy if exists "home_hero public read" on home_hero;
create policy "home_hero public read" on home_hero for select using (true);
-- writes go through /api/admin/data with the service role key, which bypasses RLS
