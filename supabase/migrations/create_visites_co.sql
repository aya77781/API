-- Remarques de visite CO
CREATE TABLE IF NOT EXISTS app.visites_remarques (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id   UUID NOT NULL REFERENCES app.projets(id) ON DELETE CASCADE,
  co_id       UUID REFERENCES app.utilisateurs(id) ON DELETE SET NULL,
  texte       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_visites_remarques_projet ON app.visites_remarques (projet_id);
ALTER TABLE app.visites_remarques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visites_remarques_all" ON app.visites_remarques FOR ALL USING (true) WITH CHECK (true);

-- Photos de visite CO
CREATE TABLE IF NOT EXISTS app.visites_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id     UUID NOT NULL REFERENCES app.projets(id) ON DELETE CASCADE,
  co_id         UUID REFERENCES app.utilisateurs(id) ON DELETE SET NULL,
  categorie     TEXT NOT NULL DEFAULT 'Divers',
  legende       TEXT,
  storage_path  TEXT NOT NULL,
  url           TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_visites_photos_projet ON app.visites_photos (projet_id);
ALTER TABLE app.visites_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visites_photos_all" ON app.visites_photos FOR ALL USING (true) WITH CHECK (true);

-- Problemes signales en visite CO
CREATE TABLE IF NOT EXISTS app.visites_problemes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id       UUID NOT NULL REFERENCES app.projets(id) ON DELETE CASCADE,
  co_id           UUID REFERENCES app.utilisateurs(id) ON DELETE SET NULL,
  titre           TEXT NOT NULL,
  description     TEXT,
  gravite         TEXT NOT NULL DEFAULT 'moyen' CHECK (gravite IN ('faible', 'moyen', 'urgent')),
  lot_corps_etat  TEXT,
  statut          TEXT NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'en_cours', 'resolu')),
  photos          TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_visites_problemes_projet ON app.visites_problemes (projet_id);
ALTER TABLE app.visites_problemes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visites_problemes_all" ON app.visites_problemes FOR ALL USING (true) WITH CHECK (true);
