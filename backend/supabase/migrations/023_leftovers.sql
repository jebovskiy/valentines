-- «Запасы» — leftover ingredients a pair already has at home. The menu
-- generator deducts these from the shopping list of the next generation.
CREATE TABLE IF NOT EXISTS leftovers (
  pair_id uuid NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  ingredient_id text NOT NULL,
  qty numeric NOT NULL CHECK (qty > 0),
  unit text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pair_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_leftovers_pair ON leftovers (pair_id);

ALTER TABLE leftovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pair members can read leftovers" ON leftovers;
CREATE POLICY "Pair members can read leftovers" ON leftovers
  FOR SELECT USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM pairs p
      WHERE p.id = leftovers.pair_id
        AND (p.telegram_user_a::text = auth.uid()::text
             OR p.telegram_user_b::text = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Service role can manage leftovers" ON leftovers;
CREATE POLICY "Service role can manage leftovers" ON leftovers
  FOR ALL USING (auth.uid() IS NULL) WITH CHECK (auth.uid() IS NULL);