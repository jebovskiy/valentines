-- Part 1: Create tables
CREATE TABLE IF NOT EXISTS movies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  kp_id integer,
  title text NOT NULL,
  year integer,
  poster_url text,
  genre text,
  description text,
  runtime text,
  rating text,
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
  review_text text,
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