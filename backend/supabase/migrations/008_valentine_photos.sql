-- Add photo_url column to valentines for photo valentines
ALTER TABLE valentines ADD COLUMN IF NOT EXISTS photo_url text;