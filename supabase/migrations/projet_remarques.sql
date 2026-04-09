-- Table projet_remarques : remarques / signalements sur un projet
-- A executer dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS app.projet_remarques (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id       uuid NOT NULL REFERENCES app.projets(id) ON DELETE CASCADE,
  auteur_id       uuid REFERENCES app.utilisateurs(id) ON DELETE SET NULL,
  type            text NOT NULL DEFAULT 'remarque'
                    CHECK (type IN ('remarque','probleme')),
  contenu         text NOT NULL,
  tagged_user_ids uuid[] NOT NULL DEFAULT '{}',
  resolu          boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remarques_projet ON app.projet_remarques(projet_id);
CREATE INDEX IF NOT EXISTS idx_remarques_created ON app.projet_remarques(created_at DESC);

ALTER TABLE app.projet_remarques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_remarques" ON app.projet_remarques
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "write_remarques" ON app.projet_remarques
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
