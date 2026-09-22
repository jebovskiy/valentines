-- «Меню» — generated menu plans and shopping lists for a pair
CREATE TABLE IF NOT EXISTS menus (
  id text PRIMARY KEY,
  pair_id uuid NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  store_id text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menus_pair_created
  ON menus (pair_id, created_at DESC);

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pair members can read menus" ON menus;
CREATE POLICY "Pair members can read menus" ON menus
  FOR SELECT USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM pairs p
      WHERE p.id = menus.pair_id
        AND (p.telegram_user_a::text = auth.uid()::text
             OR p.telegram_user_b::text = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Service role can insert menus" ON menus;
CREATE POLICY "Service role can insert menus" ON menus
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Service role can update menus" ON menus;
CREATE POLICY "Service role can update menus" ON menus
  FOR UPDATE USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Service role can delete menus" ON menus;
CREATE POLICY "Service role can delete menus" ON menus
  FOR DELETE USING (auth.uid() IS NULL);