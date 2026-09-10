-- Expand greeting types: morning, night, luck, day, evening, care.
ALTER TABLE greetings DROP CONSTRAINT IF EXISTS greetings_type_check;
ALTER TABLE greetings ADD CONSTRAINT greetings_type_check CHECK (type IN ('morning', 'night', 'luck', 'day', 'evening', 'care'));