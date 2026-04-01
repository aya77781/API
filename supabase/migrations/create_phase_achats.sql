-- ══════════════════════════════════════════════════════════════════
-- Migration : Phase Achats CO
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Compléter app.sous_traitants ──────────────────────────────
-- La table existe déjà avec : raison_sociale, corps_etat, contact_nom,
-- contact_tel, contact_email, adresse, zone_geo, note_globale, nb_projets,
-- statut ('actif'|'inactif'|'blackliste'), source, kbis/urssaf/assurances,
-- points_forts, points_faibles, remarque.
--
-- On ajoute les colonnes manquantes pour la phase achats.

ALTER TABLE app.sous_traitants
  ADD COLUMN IF NOT EXISTS specialites TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ville TEXT,
  ADD COLUMN IF NOT EXISTS departement TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS telephone TEXT,
  ADD COLUMN IF NOT EXISTS agrement TEXT DEFAULT 'non_agree'
    CHECK (agrement IN ('agree', 'non_agree', 'en_cours'));

COMMENT ON COLUMN app.sous_traitants.specialites IS 'Spécialités détaillées (ex: ["Electricité", "Plomberie"])';
COMMENT ON COLUMN app.sous_traitants.ville IS 'Ville du siège social';
COMMENT ON COLUMN app.sous_traitants.departement IS 'Département (ex: "75", "92")';
COMMENT ON COLUMN app.sous_traitants.region IS 'Région (ex: "Île-de-France")';
COMMENT ON COLUMN app.sous_traitants.email IS 'Email principal du ST (en plus de contact_email)';
COMMENT ON COLUMN app.sous_traitants.telephone IS 'Téléphone principal du ST (en plus de contact_tel)';
COMMENT ON COLUMN app.sous_traitants.agrement IS 'Statut d agrément : agree, non_agree, en_cours';

-- Index pour recherche par spécialité et localisation
CREATE INDEX IF NOT EXISTS idx_st_specialites ON app.sous_traitants USING GIN (specialites);
CREATE INDEX IF NOT EXISTS idx_st_departement ON app.sous_traitants (departement);
CREATE INDEX IF NOT EXISTS idx_st_agrement    ON app.sous_traitants (agrement);


-- ── 2. Créer app.evaluations_st ──────────────────────────────────

CREATE TABLE IF NOT EXISTS app.evaluations_st (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  st_id               UUID NOT NULL REFERENCES app.sous_traitants(id) ON DELETE CASCADE,
  projet_id           UUID NOT NULL REFERENCES app.projets(id) ON DELETE CASCADE,
  co_id               UUID NOT NULL REFERENCES app.utilisateurs(id) ON DELETE SET NULL,
  note_qualite        INTEGER NOT NULL CHECK (note_qualite BETWEEN 1 AND 5),
  note_delai          INTEGER NOT NULL CHECK (note_delai BETWEEN 1 AND 5),
  note_communication  INTEGER NOT NULL CHECK (note_communication BETWEEN 1 AND 5),
  note_globale        NUMERIC GENERATED ALWAYS AS (
                        (note_qualite + note_delai + note_communication) / 3.0
                      ) STORED,
  commentaire         TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  app.evaluations_st IS 'Évaluations des sous-traitants par les CO après chaque projet';
COMMENT ON COLUMN app.evaluations_st.note_globale IS 'Moyenne auto-calculée des 3 notes (stored generated)';

CREATE INDEX idx_eval_st      ON app.evaluations_st (st_id);
CREATE INDEX idx_eval_projet  ON app.evaluations_st (projet_id);
CREATE INDEX idx_eval_co      ON app.evaluations_st (co_id);

-- RLS
ALTER TABLE app.evaluations_st ENABLE ROW LEVEL SECURITY;

-- Lecture : CO voit ses évaluations + admin voit tout
CREATE POLICY "evaluations_st_select"
  ON app.evaluations_st FOR SELECT
  USING (
    auth.uid() = co_id
    OR EXISTS (
      SELECT 1 FROM app.utilisateurs
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insertion : seul le CO auteur
CREATE POLICY "evaluations_st_insert"
  ON app.evaluations_st FOR INSERT
  WITH CHECK (auth.uid() = co_id);

-- Mise à jour : seul le CO auteur
CREATE POLICY "evaluations_st_update"
  ON app.evaluations_st FOR UPDATE
  USING (auth.uid() = co_id)
  WITH CHECK (auth.uid() = co_id);

-- Suppression : seul le CO auteur ou admin
CREATE POLICY "evaluations_st_delete"
  ON app.evaluations_st FOR DELETE
  USING (
    auth.uid() = co_id
    OR EXISTS (
      SELECT 1 FROM app.utilisateurs
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ── 3. Créer app.consultations_st ────────────────────────────────

CREATE TABLE IF NOT EXISTS app.consultations_st (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id           UUID NOT NULL REFERENCES app.projets(id) ON DELETE CASCADE,
  lot_id              UUID NOT NULL REFERENCES app.lots(id) ON DELETE CASCADE,
  st_id               UUID NOT NULL REFERENCES app.sous_traitants(id) ON DELETE CASCADE,
  statut              TEXT NOT NULL DEFAULT 'a_contacter'
                        CHECK (statut IN (
                          'a_contacter', 'contacte', 'devis_demande',
                          'devis_recu', 'refuse', 'attribue'
                        )),
  note_contact        TEXT,
  email_envoye_at     TIMESTAMPTZ,
  devis_recu_at       TIMESTAMPTZ,
  montant_devis       NUMERIC,
  delai_propose       INTEGER,
  note_negociation    TEXT,
  score_ia            NUMERIC,
  attribue            BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  app.consultations_st IS 'Suivi de consultation des ST par lot pour la phase achats';
COMMENT ON COLUMN app.consultations_st.note_contact IS 'Note rapide post-appel téléphonique';
COMMENT ON COLUMN app.consultations_st.delai_propose IS 'Délai proposé par le ST en jours';
COMMENT ON COLUMN app.consultations_st.score_ia IS 'Score IA calculé (60% prix / 40% délai)';

-- Index
CREATE INDEX idx_consult_projet ON app.consultations_st (projet_id);
CREATE INDEX idx_consult_lot    ON app.consultations_st (lot_id);
CREATE INDEX idx_consult_st     ON app.consultations_st (st_id);
CREATE INDEX idx_consult_statut ON app.consultations_st (statut);

-- Unicité : un ST ne peut être consulté qu'une fois par lot
CREATE UNIQUE INDEX idx_consult_unique ON app.consultations_st (lot_id, st_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_consultations_st_updated ON app.consultations_st;
CREATE TRIGGER trg_consultations_st_updated
  BEFORE UPDATE ON app.consultations_st
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- RLS
ALTER TABLE app.consultations_st ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les utilisateurs authentifiés (les économistes,
-- gérants et commerciaux doivent aussi voir les consultations)
CREATE POLICY "consultations_st_select"
  ON app.consultations_st FOR SELECT
  USING (true);

-- Insertion : CO et admin
CREATE POLICY "consultations_st_insert"
  ON app.consultations_st FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.utilisateurs
      WHERE id = auth.uid() AND role IN ('co', 'admin')
    )
  );

-- Mise à jour : CO et admin
CREATE POLICY "consultations_st_update"
  ON app.consultations_st FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM app.utilisateurs
      WHERE id = auth.uid() AND role IN ('co', 'admin')
    )
  );

-- Suppression : admin uniquement
CREATE POLICY "consultations_st_delete"
  ON app.consultations_st FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM app.utilisateurs
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
