-- ── GED : Documents ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app.documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id        UUID REFERENCES app.projets(id) ON DELETE CASCADE,
  lot_id           UUID REFERENCES app.lots(id) ON DELETE SET NULL,
  nom_fichier      TEXT NOT NULL,
  type_doc         TEXT NOT NULL CHECK (type_doc IN (
                     'compte_rendu','plan','devis','contrat','rapport_bc',
                     'facture','photo','audio','piece_admin','autre'
                   )),
  dossier_ged      TEXT NOT NULL CHECK (dossier_ged IN (
                     '00_client','01_etudes','02_commercial','03_contractuels',
                     '04_conception','05_urbanisme','06_preparation',
                     '07_chantier','08_facturation','09_gpa','10_sav'
                   )),
  storage_path     TEXT NOT NULL,
  url              TEXT,
  uploaded_by      UUID REFERENCES app.utilisateurs(id) ON DELETE SET NULL,
  role_source      TEXT,
  tags_utilisateurs UUID[] DEFAULT '{}',
  tags_roles       TEXT[]  DEFAULT '{}',
  message_depot    TEXT,
  onedrive_sync    BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_open" ON app.documents FOR ALL USING (true) WITH CHECK (true);

-- ── Notifications documents ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app.notifs_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID REFERENCES app.documents(id) ON DELETE CASCADE,
  projet_id        UUID REFERENCES app.projets(id) ON DELETE CASCADE,
  destinataire_id  UUID REFERENCES app.utilisateurs(id) ON DELETE CASCADE,
  lu               BOOLEAN DEFAULT false,
  lu_le            TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app.notifs_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifs_documents_open" ON app.notifs_documents FOR ALL USING (true) WITH CHECK (true);

-- Index pour les requêtes par destinataire
CREATE INDEX IF NOT EXISTS idx_notifs_documents_destinataire
  ON app.notifs_documents (destinataire_id, lu, created_at DESC);

-- ── Alertes générales ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app.alertes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id      UUID REFERENCES app.projets(id) ON DELETE CASCADE,
  utilisateur_id UUID REFERENCES app.utilisateurs(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN (
                   'document','plan_mis_a_jour','reserve_signalee',
                   'devis_demande','relance_devis','revision_demandee',
                   'reserve_levee','document_expire','autre'
                 )),
  titre          TEXT,
  message        TEXT,
  priorite       TEXT DEFAULT 'normal' CHECK (priorite IN ('low','normal','high','urgent')),
  lu             BOOLEAN DEFAULT false,
  lu_le          TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app.alertes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alertes_open" ON app.alertes FOR ALL USING (true) WITH CHECK (true);

-- ── Realtime ────────────────────────────────────────────────────────
-- Activer la réplication Realtime sur notifs_documents dans le dashboard Supabase :
-- Database → Replication → Tables → cocher app.notifs_documents
