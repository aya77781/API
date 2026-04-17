-- Ajout colonne economiste_id sur dessin_plans
-- L'economiste est choisi au moment de la validation et notifie automatiquement

ALTER TABLE app.dessin_plans ADD COLUMN IF NOT EXISTS economiste_id UUID REFERENCES app.utilisateurs(id) ON DELETE SET NULL;

COMMENT ON COLUMN app.dessin_plans.economiste_id IS 'Economiste assigne lors de la validation du plan — notifie automatiquement';
