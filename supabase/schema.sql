-- Kør i Supabase SQL editor (eller lad Supabase MCP køre den som migration). Én tabel er nok:
-- løsningen gemmes som JSON.
create table if not exists public.solutions (
  id text primary key,
  name text not null default '',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.solutions enable row level security;

-- Tabellen er lukket for anon og authenticated. Uden login går al adgang gennem to RPC-funktioner,
-- så en klient skal kende et id for at læse eller skrive. Ingen kan liste alle løsninger eller
-- overskrive dem samlet. Stram yderligere til (ejerskab), når der kommer auth på.
revoke all on table public.solutions from anon, authenticated;
drop policy if exists "anon read" on public.solutions;
drop policy if exists "anon write" on public.solutions;
drop policy if exists "anon update" on public.solutions;

create or replace function public.load_solution(p_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select data from public.solutions where id = p_id
$$;

create or replace function public.save_solution(p_id text, p_name text, p_data jsonb, p_updated_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id !~ '^[a-z0-9]{4,16}$' then
    raise exception 'ugyldigt id';
  end if;
  if pg_column_size(p_data) > 200000 then
    raise exception 'løsningen er for stor';
  end if;
  insert into public.solutions (id, name, data, updated_at)
  values (p_id, coalesce(p_name, ''), p_data, coalesce(p_updated_at, now()))
  on conflict (id) do update
    set name = excluded.name, data = excluded.data, updated_at = excluded.updated_at;
end
$$;

revoke all on function public.load_solution(text) from public;
revoke all on function public.save_solution(text, text, jsonb, timestamptz) from public;
grant execute on function public.load_solution(text) to anon, authenticated;
grant execute on function public.save_solution(text, text, jsonb, timestamptz) to anon, authenticated;
