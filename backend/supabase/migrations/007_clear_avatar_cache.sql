-- Force refetch avatar file paths for all users on the next request.
-- Clears the cached avatar_file_path so getAvatarFilePath() re-resolves
-- the current Telegram profile photo instead of serving a stale path.
UPDATE user_profiles
SET avatar_file_path = NULL,
    updated_at = now()
WHERE avatar_file_path IS NOT NULL;