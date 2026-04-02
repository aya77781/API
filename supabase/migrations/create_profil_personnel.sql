-- Profil personnel etendu
ALTER TABLE app.utilisateurs
  ADD COLUMN IF NOT EXISTS adresse TEXT,
  ADD COLUMN IF NOT EXISTS ville TEXT,
  ADD COLUMN IF NOT EXISTS code_postal TEXT,
  ADD COLUMN IF NOT EXISTS telephone_perso TEXT,
  ADD COLUMN IF NOT EXISTS email_perso TEXT,
  ADD COLUMN IF NOT EXISTS date_naissance DATE,
  ADD COLUMN IF NOT EXISTS lieu_naissance TEXT,
  ADD COLUMN IF NOT EXISTS nationalite TEXT,
  ADD COLUMN IF NOT EXISTS numero_secu TEXT,
  ADD COLUMN IF NOT EXISTS rib_iban TEXT,
  ADD COLUMN IF NOT EXISTS rib_bic TEXT,
  ADD COLUMN IF NOT EXISTS contact_urgence_nom TEXT,
  ADD COLUMN IF NOT EXISTS contact_urgence_tel TEXT,
  ADD COLUMN IF NOT EXISTS contact_urgence_lien TEXT,
  ADD COLUMN IF NOT EXISTS statut_emploi TEXT DEFAULT 'actif'
    CHECK (statut_emploi IN ('actif', 'periode_essai', 'conge', 'inactif'));

-- Documents personnels
CREATE TABLE IF NOT EXISTS app.documents_personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id UUID NOT NULL REFERENCES app.utilisateurs(id) ON DELETE CASCADE,
  type_doc TEXT NOT NULL CHECK (type_doc IN (
    'carte_identite', 'securite_sociale', 'casier_judiciaire',
    'rib', 'photo', 'permis_conduire', 'diplome', 'autre'
  )),
  nom_fichier TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT,
  expire_le DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_docs_personnel_user ON app.documents_personnel (utilisateur_id);
ALTER TABLE app.documents_personnel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_personnel_all" ON app.documents_personnel FOR ALL USING (true) WITH CHECK (true);
