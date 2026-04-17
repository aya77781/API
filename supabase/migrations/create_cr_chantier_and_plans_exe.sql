-- CR de chantier rediges par le CO
CREATE TABLE IF NOT EXISTS app.cr_chantier (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id       UUID NOT NULL REFERENCES app.projets(id) ON DELETE CASCADE,
  co_id           UUID NOT NULL REFERENCES app.utilisateurs(id) ON DELETE CASCADE,
  titre           TEXT NOT NULL,
  contenu         TEXT NOT NULL,
  date_visite     DATE NOT NULL DEFAULT CURRENT_DATE,
  lots_impactes   UUID[] DEFAULT '{}',
  statut          TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'publie')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cr_chantier_projet ON app.cr_chantier(projet_id);
CREATE INDEX idx_cr_chantier_statut ON app.cr_chantier(statut);

-- Plans d'execution geres par la dessinatrice
CREATE TABLE IF NOT EXISTS app.plans_exe (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id       UUID NOT NULL REFERENCES app.projets(id) ON DELETE CASCADE,
  lot_id          UUID NOT NULL REFERENCES app.lots(id) ON DELETE CASCADE,
  indice          TEXT NOT NULL DEFAULT 'A',
  fichier_url     TEXT,
  fichier_nom     TEXT,
  statut          TEXT NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'valide', 'archive')),
  cr_source_id    UUID REFERENCES app.cr_chantier(id) ON DELETE SET NULL,
  notes           TEXT,
  created_by      UUID REFERENCES app.utilisateurs(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_plans_exe_projet ON app.plans_exe(projet_id);
CREATE INDEX idx_plans_exe_lot ON app.plans_exe(lot_id);
