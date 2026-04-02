-- Table des ST potentiels (ajoutes depuis la prospection Google Maps)
CREATE TABLE IF NOT EXISTS app.st_potentiels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id       UUID REFERENCES app.projets(id) ON DELETE CASCADE,
  lot_id          UUID REFERENCES app.lots(id) ON DELETE CASCADE,
  co_id           UUID REFERENCES app.utilisateurs(id) ON DELETE SET NULL,
  raison_sociale  TEXT NOT NULL,
  adresse         TEXT,
  contact_tel     TEXT,
  contact_email   TEXT,
  site_web        TEXT,
  note_google     NUMERIC,
  nb_avis_google  INTEGER,
  lot_corps_etat  TEXT,
  st_id           UUID REFERENCES app.sous_traitants(id) ON DELETE SET NULL,
  confirmed       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_st_potentiels_lot ON app.st_potentiels (lot_id);
CREATE INDEX idx_st_potentiels_projet ON app.st_potentiels (projet_id);

ALTER TABLE app.st_potentiels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "st_potentiels_all" ON app.st_potentiels FOR ALL USING (true) WITH CHECK (true);
