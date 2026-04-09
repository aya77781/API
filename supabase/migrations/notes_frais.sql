-- Notes de frais : saisies par les employés, validées par la RH
create table if not exists public.notes_frais (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  libelle         text not null,
  categorie       text not null default 'autre',
  montant_ttc     numeric(12,2) not null check (montant_ttc >= 0),
  tva_pct         numeric(5,2) default 20,
  date_depense    date not null default current_date,
  projet_id       uuid references public.projets(id) on delete set null,
  justificatif_url text,
  commentaire     text,
  statut          text not null default 'soumise'
                  check (statut in ('soumise','validee','refusee','remboursee')),
  motif_refus     text,
  validee_par     uuid references auth.users(id),
  validee_le      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_notes_frais_user   on public.notes_frais(user_id);
create index if not exists idx_notes_frais_statut on public.notes_frais(statut);
create index if not exists idx_notes_frais_date   on public.notes_frais(date_depense desc);

alter table public.notes_frais enable row level security;

-- L'employé voit et gère ses propres NDF
drop policy if exists ndf_select_own on public.notes_frais;
create policy ndf_select_own on public.notes_frais
  for select using (auth.uid() = user_id);

drop policy if exists ndf_insert_own on public.notes_frais;
create policy ndf_insert_own on public.notes_frais
  for insert with check (auth.uid() = user_id);

drop policy if exists ndf_update_own on public.notes_frais;
create policy ndf_update_own on public.notes_frais
  for update using (auth.uid() = user_id and statut = 'soumise');

drop policy if exists ndf_delete_own on public.notes_frais;
create policy ndf_delete_own on public.notes_frais
  for delete using (auth.uid() = user_id and statut = 'soumise');

-- La RH (et compta/admin) voient et valident toutes les NDF
drop policy if exists ndf_select_rh on public.notes_frais;
create policy ndf_select_rh on public.notes_frais
  for select using (
    exists (
      select 1 from public.profil p
      where p.user_id = auth.uid()
        and p.role in ('rh','compta','admin','gerant')
    )
  );

drop policy if exists ndf_update_rh on public.notes_frais;
create policy ndf_update_rh on public.notes_frais
  for update using (
    exists (
      select 1 from public.profil p
      where p.user_id = auth.uid()
        and p.role in ('rh','compta','admin','gerant')
    )
  );
