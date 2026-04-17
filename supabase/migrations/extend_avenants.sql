-- Extension de la table avenants pour gerer les cas (avant_debut / pendant / apres_fin),
-- le lot concerne, le ST consulte, le devis genere et le workflow de validation.

ALTER TABLE app.avenants
  ADD COLUMN IF NOT EXISTS titre          text,
  ADD COLUMN IF NOT EXISTS cas            text,
  ADD COLUMN IF NOT EXISTS lot_id         uuid,
  ADD COLUMN IF NOT EXISTS acces_st_id    uuid,
  ADD COLUMN IF NOT EXISTS devis_id       uuid,
  ADD COLUMN IF NOT EXISTS code           text,
  ADD COLUMN IF NOT EXISTS created_by     uuid,
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz DEFAULT now();

-- Foreign keys (best effort — si les tables cibles existent dans app)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'avenants_lot_id_fkey' AND table_schema = 'app'
  ) THEN
    ALTER TABLE app.avenants
      ADD CONSTRAINT avenants_lot_id_fkey
      FOREIGN KEY (lot_id) REFERENCES app.lots(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'avenants_created_by_fkey' AND table_schema = 'app'
  ) THEN
    ALTER TABLE app.avenants
      ADD CONSTRAINT avenants_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES app.utilisateurs(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Elargit le CHECK statut pour accepter les nouvelles valeurs workflow
ALTER TABLE app.avenants DROP CONSTRAINT IF EXISTS avenants_statut_check;
ALTER TABLE app.avenants
  ADD CONSTRAINT avenants_statut_check
  CHECK (statut IN ('ouvert','chiffre','devis_recu','valide_co','valide_client','integre','refuse'));

-- CHECK cas
ALTER TABLE app.avenants DROP CONSTRAINT IF EXISTS avenants_cas_check;
ALTER TABLE app.avenants
  ADD CONSTRAINT avenants_cas_check
  CHECK (cas IS NULL OR cas IN ('avant_debut','pendant','apres_fin'));

-- Index pour les requetes frequentes
CREATE INDEX IF NOT EXISTS avenants_lot_id_idx    ON app.avenants(lot_id);
CREATE INDEX IF NOT EXISTS avenants_statut_idx    ON app.avenants(statut);
CREATE INDEX IF NOT EXISTS avenants_created_by_idx ON app.avenants(created_by);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION app.tg_avenants_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_avenants_updated_at ON app.avenants;
CREATE TRIGGER trg_avenants_updated_at
  BEFORE UPDATE ON app.avenants
  FOR EACH ROW EXECUTE FUNCTION app.tg_avenants_updated_at();
