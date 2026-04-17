-- Commentaires sur les plans de conception (dessin)
-- Les personnes taguees (a_valider / a_voir) peuvent laisser des retours

CREATE TABLE IF NOT EXISTS app.dessin_plan_commentaires (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES app.dessin_plans(id) ON DELETE CASCADE,
  utilisateur_id  UUID NOT NULL REFERENCES app.utilisateurs(id) ON DELETE CASCADE,
  contenu         TEXT NOT NULL CHECK (char_length(contenu) > 0),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dessin_plan_commentaires_plan ON app.dessin_plan_commentaires(plan_id);

COMMENT ON TABLE app.dessin_plan_commentaires IS 'Commentaires des personnes concernees sur les plans de conception';
