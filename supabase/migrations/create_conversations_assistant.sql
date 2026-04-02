CREATE TABLE IF NOT EXISTS app.conversations_assistant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid REFERENCES app.utilisateurs(id) ON DELETE CASCADE,
  projet_id uuid REFERENCES app.projets(id) ON DELETE SET NULL,
  messages jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_conv_assistant_user ON app.conversations_assistant (utilisateur_id);
ALTER TABLE app.conversations_assistant ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_assistant_all" ON app.conversations_assistant FOR ALL USING (true) WITH CHECK (true);
