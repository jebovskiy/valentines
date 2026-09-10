-- Shared movie list for a pair + reviews + AI insights.
-- Poiskkino (KinoPoisk) metadata; reviews on 6 aspects; per-partner "watched" marks; one AI
-- insight per movie generated once both partners reviewed it.

CREATE TABLE IF NOT EXISTS movies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  kp_id integer,
  title text NOT NULL,
  year integer,
  poster_url text,
  genre text,
  plot text,
  runtime text,
  imdb_rating text,
  status text NOT NULL DEFAULT 'want_to_watch' CHECK (status IN ('want_to_watch', 'watched')),
  added_by bigint NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  watched_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_movies_pair ON movies (pair_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_movies_pair_status ON movies (pair_id, status);

CREATE TABLE IF NOT EXISTS movie_watches (
  movie_id uuid NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  author_telegram_id bigint NOT NULL,
  watched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (movie_id, author_telegram_id)
);

CREATE TABLE IF NOT EXISTS movie_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id uuid NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  author_telegram_id bigint NOT NULL,
  visuals integer NOT NULL,
  plot integer NOT NULL,
  acting integer NOT NULL,
  music integer NOT NULL,
  atmosphere integer NOT NULL,
  humor integer NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (movie_id, author_telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_movie_reviews_movie ON movie_reviews (movie_id);

CREATE TABLE IF NOT EXISTS movie_insights (
  movie_id uuid PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movie_reminder_log (
  pair_id uuid PRIMARY KEY REFERENCES pairs(id) ON DELETE CASCADE,
  last_sent_on date NOT NULL
);

ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pair members can read movies" ON movies;
CREATE POLICY "Pair members can read movies" ON movies
  FOR SELECT USING (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM pairs p
      WHERE p.id = movies.pair_id
        AND (p.telegram_user_a::text = auth.uid()::text
             OR p.telegram_user_b::text = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Pair members can write movies" ON movies;
CREATE POLICY "Pair members can write movies" ON movies
  FOR ALL USING (auth.uid() IS NULL) WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Pair members can read movie_watches" ON movie_watches;
CREATE POLICY "Pair members can read movie_watches" ON movie_watches
  FOR SELECT USING (auth.uid() IS NULL OR EXISTS (
    SELECT 1 FROM movies m JOIN pairs p ON p.id = m.pair_id
    WHERE m.id = movie_watches.movie_id
      AND (p.telegram_user_a::text = auth.uid()::text
           OR p.telegram_user_b::text = auth.uid()::text)
  ));

DROP POLICY IF EXISTS "Pair members can write movie_watches" ON movie_watches;
CREATE POLICY "Pair members can write movie_watches" ON movie_watches
  FOR ALL USING (auth.uid() IS NULL) WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Pair members can read movie_reviews" ON movie_reviews;
CREATE POLICY "Pair members can read movie_reviews" ON movie_reviews
  FOR SELECT USING (auth.uid() IS NULL OR EXISTS (
    SELECT 1 FROM movies m JOIN pairs p ON p.id = m.pair_id
    WHERE m.id = movie_reviews.movie_id
      AND (p.telegram_user_a::text = auth.uid()::text
           OR p.telegram_user_b::text = auth.uid()::text)
  ));

DROP POLICY IF EXISTS "Pair members can write movie_reviews" ON movie_reviews;
CREATE POLICY "Pair members can write movie_reviews" ON movie_reviews
  FOR ALL USING (auth.uid() IS NULL) WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Pair members can read movie_insights" ON movie_insights;
CREATE POLICY "Pair members can read movie_insights" ON movie_insights
  FOR SELECT USING (auth.uid() IS NULL OR EXISTS (
    SELECT 1 FROM movies m JOIN pairs p ON p.id = m.pair_id
    WHERE m.id = movie_insights.movie_id
      AND (p.telegram_user_a::text = auth.uid()::text
           OR p.telegram_user_b::text = auth.uid()::text)
  ));

DROP POLICY IF EXISTS "Pair members can write movie_insights" ON movie_insights;
CREATE POLICY "Pair members can write movie_insights" ON movie_insights
  FOR ALL USING (auth.uid() IS NULL) WITH CHECK (auth.uid() IS NULL);