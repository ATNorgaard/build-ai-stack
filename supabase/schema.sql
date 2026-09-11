-- Kør i Supabase SQL editor. Én tabel er nok: løsningen gemmes som JSON.
create table if not exists public.solutions (
  id text primary key,
  name text not null default '',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.solutions enable row level security;

-- Uden login: alle med anon-nøglen må læse og skrive. Stram til, når der kommer auth på.
create policy "anon read"  on public.solutions for select using (true);
create policy "anon write" on public.solutions for insert with check (true);
create policy "anon update" on public.solutions for update using (true) with check (true);
