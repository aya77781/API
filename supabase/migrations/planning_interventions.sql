-- Table planning_interventions
-- A executer dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS app.planning_interventions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id       uuid NOT NULL REFERENCES app.projets(id) ON DELETE CASCADE,
  lot_id          uuid REFERENCES app.lots(id) ON DELETE SET NULL,
  st_id           uuid REFERENCES app.sous_traitants(id) ON DELETE SET NULL,
  corps_etat      text NOT NULL,
  st_nom          text,
  date_debut      date NOT NULL,
  date_fin        date NOT NULL,
  avancement_pct  int  NOT NULL DEFAULT 0 CHECK (avancement_pct BETWEEN 0 AND 100),
  statut          text NOT NULL DEFAULT 'planifie'
                    CHECK (statut IN ('planifie','confirme','en_cours','termine','retarde')),
  couleur         text,
  notes           text,
  created_by      uuid REFERENCES app.utilisateurs(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planning_projet ON app.planning_interventions(projet_id);
CREATE INDEX IF NOT EXISTS idx_planning_dates  ON app.planning_interventions(date_debut, date_fin);

-- RLS
ALTER TABLE app.planning_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_planning" ON app.planning_interventions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "write_planning" ON app.planning_interventions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
