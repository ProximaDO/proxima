-- ============================================================
-- Migracion: Site settings + Coming Soon landing
-- Fecha: 2026-06-25
-- ============================================================

create table if not exists site_settings (
  id                    smallint primary key default 1 check (id = 1),
  coming_soon_enabled   boolean not null default false,
  coming_soon_target_at timestamptz,
  coming_soon_title     text not null default 'Proximamente',
  coming_soon_message   text not null default 'Estamos preparando una experiencia increible para Proxima.',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table site_settings enable row level security;

create policy "site settings public read"
  on site_settings for select
  using (true);

create policy "site settings admin insert"
  on site_settings for insert
  with check (
    exists (
      select 1
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'
    )
  );

create policy "site settings admin update"
  on site_settings for update
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

insert into site_settings (
  id,
  coming_soon_enabled,
  coming_soon_title,
  coming_soon_message
)
values (
  1,
  false,
  'Proximamente',
  'Estamos preparando una experiencia increible para Proxima.'
)
on conflict (id) do nothing;
