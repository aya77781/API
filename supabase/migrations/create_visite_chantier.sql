-- ══════════════════════════════════════════════════════════════════
-- Migration : Visite de chantier (checklist terrain + tournée)
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Recréer app.checklists ────────────────────────────────────

DROP TABLE IF EXISTS app.checklists CASCADE;

CREATE TABLE app.checklists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id   UUID NOT NULL REFERENCES app.projets(id) ON DELETE CASCADE,
  lot_id      UUID REFERENCES app.lots(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('terrain', 'opr', 'gpa')),
  points      JSONB NOT NULL DEFAULT '[]',
  -- chaque point : { id, label, statut, note, photo_url, is_custom }
  created_by  UUID REFERENCES app.utilisateurs(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  app.checklists IS 'Checklists de visite terrain, OPR, GPA';
COMMENT ON COLUMN app.checklists.points IS 'JSON array : [{ id, label, statut, note, photo_url, is_custom }]';

-- Index pour les requêtes fréquentes
CREATE INDEX idx_checklists_projet    ON app.checklists (projet_id);
CREATE INDEX idx_checklists_lot       ON app.checklists (lot_id);
CREATE INDEX idx_checklists_created   ON app.checklists (created_by);
CREATE INDEX idx_checklists_type      ON app.checklists (type);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_checklists_updated ON app.checklists;
CREATE TRIGGER trg_checklists_updated
  BEFORE UPDATE ON app.checklists
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- RLS
ALTER TABLE app.checklists ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié sur le même projet
CREATE POLICY "checklists_select"
  ON app.checklists FOR SELECT
  USING (true);

-- Insertion : seul le créateur
CREATE POLICY "checklists_insert"
  ON app.checklists FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Mise à jour : seul le créateur
CREATE POLICY "checklists_update"
  ON app.checklists FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Suppression : seul le créateur
CREATE POLICY "checklists_delete"
  ON app.checklists FOR DELETE
  USING (auth.uid() = created_by);


-- ── 2. Créer app.checklists_templates ────────────────────────────

CREATE TABLE IF NOT EXISTS app.checklists_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_type    TEXT NOT NULL,
  -- ex: "Electricité", "Plomberie", "Menuiserie", "Gros œuvre"
  type        TEXT NOT NULL CHECK (type IN ('terrain', 'opr', 'gpa')),
  points      JSONB NOT NULL DEFAULT '[]',
  -- chaque point : { id, label, ordre }
  created_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  app.checklists_templates IS 'Modèles de points de contrôle par type de lot';
COMMENT ON COLUMN app.checklists_templates.lot_type IS 'Corps d état du lot (doit correspondre à lots.corps_etat)';
COMMENT ON COLUMN app.checklists_templates.points IS 'JSON array : [{ id, label, ordre }]';

CREATE UNIQUE INDEX idx_templates_unique ON app.checklists_templates (lot_type, type);

-- RLS : lecture pour tous, écriture admin uniquement
ALTER TABLE app.checklists_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select"
  ON app.checklists_templates FOR SELECT
  USING (true);

CREATE POLICY "templates_insert"
  ON app.checklists_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.utilisateurs
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "templates_update"
  ON app.checklists_templates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM app.utilisateurs
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "templates_delete"
  ON app.checklists_templates FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM app.utilisateurs
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ── 3. Modifier app.comptes_rendus ───────────────────────────────

-- Ajouter la colonne participants (jsonb)
ALTER TABLE app.comptes_rendus
  ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]';

COMMENT ON COLUMN app.comptes_rendus.participants IS 'JSON array des participants : [{ nom, role, entreprise? }]';

-- Élargir le CHECK sur la colonne type pour inclure tournee_terrain
-- (DROP l'ancienne contrainte puis recréer)
DO $$
BEGIN
  -- Supprimer toute contrainte CHECK existante sur la colonne type
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage ccu
    JOIN information_schema.table_constraints tc
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE ccu.table_schema = 'app'
      AND ccu.table_name = 'comptes_rendus'
      AND ccu.column_name = 'type'
      AND tc.constraint_type = 'CHECK'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE app.comptes_rendus DROP CONSTRAINT ' || tc.constraint_name
      FROM information_schema.constraint_column_usage ccu
      JOIN information_schema.table_constraints tc
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
      WHERE ccu.table_schema = 'app'
        AND ccu.table_name = 'comptes_rendus'
        AND ccu.column_name = 'type'
        AND tc.constraint_type = 'CHECK'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE app.comptes_rendus
  ADD CONSTRAINT comptes_rendus_type_check
  CHECK (type IN ('passation', 'lancement', 'chantier', 'opr', 'autre', 'reunion', 'tournee_terrain'));


-- ── 4. Seed : templates par défaut pour les tournées terrain ─────

INSERT INTO app.checklists_templates (lot_type, type, points) VALUES

('Gros œuvre', 'terrain', '[
  {"id": "go_1", "label": "État des fondations / radier", "ordre": 1},
  {"id": "go_2", "label": "Alignement et aplomb des murs", "ordre": 2},
  {"id": "go_3", "label": "Qualité du béton (fissures, nid de cailloux)", "ordre": 3},
  {"id": "go_4", "label": "Réservations (gaines, passages)", "ordre": 4},
  {"id": "go_5", "label": "Étanchéité en pied de mur", "ordre": 5}
]'),

('Plomberie', 'terrain', '[
  {"id": "pl_1", "label": "Étanchéité des réseaux EU/EV", "ordre": 1},
  {"id": "pl_2", "label": "Repérage et isolation des canalisations", "ordre": 2},
  {"id": "pl_3", "label": "Pression des réseaux (essai)", "ordre": 3},
  {"id": "pl_4", "label": "Évacuations et pentes", "ordre": 4},
  {"id": "pl_5", "label": "Raccordements sanitaires", "ordre": 5}
]'),

('Électricité', 'terrain', '[
  {"id": "el_1", "label": "Conformité du tableau électrique", "ordre": 1},
  {"id": "el_2", "label": "Passage des gaines et chemin de câble", "ordre": 2},
  {"id": "el_3", "label": "Mise à la terre", "ordre": 3},
  {"id": "el_4", "label": "Appareillage (prises, interrupteurs)", "ordre": 4},
  {"id": "el_5", "label": "Éclairage (type, positionnement)", "ordre": 5}
]'),

('CVC', 'terrain', '[
  {"id": "cv_1", "label": "Pose des unités intérieures/extérieures", "ordre": 1},
  {"id": "cv_2", "label": "Réseau de gaines aérauliques", "ordre": 2},
  {"id": "cv_3", "label": "Isolation des réseaux", "ordre": 3},
  {"id": "cv_4", "label": "Raccordement et mise en service", "ordre": 4},
  {"id": "cv_5", "label": "Régulation et thermostat", "ordre": 5}
]'),

('Menuiserie', 'terrain', '[
  {"id": "me_1", "label": "Pose des huisseries", "ordre": 1},
  {"id": "me_2", "label": "Alignement et jeu des ouvrants", "ordre": 2},
  {"id": "me_3", "label": "Quincaillerie et serrurerie", "ordre": 3},
  {"id": "me_4", "label": "Vitrage (type, épaisseur)", "ordre": 4},
  {"id": "me_5", "label": "Joints et étanchéité", "ordre": 5}
]'),

('Peinture', 'terrain', '[
  {"id": "pe_1", "label": "Préparation des supports", "ordre": 1},
  {"id": "pe_2", "label": "Nombre de couches appliquées", "ordre": 2},
  {"id": "pe_3", "label": "Teintes conformes au choix client", "ordre": 3},
  {"id": "pe_4", "label": "Uniformité et finition", "ordre": 4},
  {"id": "pe_5", "label": "Protection des ouvrages adjacents", "ordre": 5}
]'),

('Revêtement de sol', 'terrain', '[
  {"id": "rs_1", "label": "Planéité du support", "ordre": 1},
  {"id": "rs_2", "label": "Pose (alignement, joints)", "ordre": 2},
  {"id": "rs_3", "label": "Découpes (plinthes, seuils)", "ordre": 3},
  {"id": "rs_4", "label": "Propreté de finition", "ordre": 4},
  {"id": "rs_5", "label": "Protection des sols posés", "ordre": 5}
]')

ON CONFLICT (lot_type, type) DO NOTHING;
