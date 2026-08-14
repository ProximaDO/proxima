-- ============================================================
-- Migracion: Catalogo de categorias de mercados
-- Fecha: 2026-06-26
-- ============================================================

create table if not exists market_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_market_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_market_categories_updated_at on market_categories;
create trigger trg_market_categories_updated_at
before update on market_categories
for each row
execute function set_market_categories_updated_at();

alter table market_categories enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'market_categories'
      and policyname = 'market categories admin select'
  ) then
    create policy "market categories admin select"
      on market_categories for select
      to authenticated
      using (
        exists (
          select 1
          from user_roles ur
          where ur.user_id = auth.uid()
            and ur.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'market_categories'
      and policyname = 'market categories admin insert'
  ) then
    create policy "market categories admin insert"
      on market_categories for insert
      to authenticated
      with check (
        exists (
          select 1
          from user_roles ur
          where ur.user_id = auth.uid()
            and ur.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'market_categories'
      and policyname = 'market categories admin update'
  ) then
    create policy "market categories admin update"
      on market_categories for update
      to authenticated
      using (
        exists (
          select 1
          from user_roles ur
          where ur.user_id = auth.uid()
            and ur.role = 'admin'
        )
      )
      with check (
        exists (
          select 1
          from user_roles ur
          where ur.user_id = auth.uid()
            and ur.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'market_categories'
      and policyname = 'market categories admin delete'
  ) then
    create policy "market categories admin delete"
      on market_categories for delete
      to authenticated
      using (
        exists (
          select 1
          from user_roles ur
          where ur.user_id = auth.uid()
            and ur.role = 'admin'
        )
      );
  end if;
end $$;

insert into market_categories (name)
select distinct trim(m.category)
from markets m
where m.category is not null
  and trim(m.category) <> ''
on conflict (name) do nothing;
