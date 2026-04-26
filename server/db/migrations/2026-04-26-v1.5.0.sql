-- Migration: bring guide-nuxt schema in line with backend v1.5.0.
-- Idempotent (uses IF NOT EXISTS / IF EXISTS guards). Safe to re-run.

-- 1) user_role enum: add 'vendor' if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'vendor'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'vendor';
  END IF;
END$$;

-- 2) service_account_type enum (new)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_account_type') THEN
    CREATE TYPE service_account_type AS ENUM ('CP-1', 'CP-2', 'Admin');
  END IF;
END$$;

-- 3) users: telegram fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_telegram_id_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_telegram_id_unique UNIQUE (telegram_id);
  END IF;
END$$;

-- 4) bookings: new columns; drop deprecated status (status is now computed)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_radio BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS curator_name TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE bookings DROP COLUMN IF EXISTS status;

-- 5) guides: bonus_points + soft delete
ALTER TABLE guides ADD COLUMN IF NOT EXISTS bonus_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS removed BOOLEAN NOT NULL DEFAULT FALSE;

-- 6) guests: optional email
ALTER TABLE guests ADD COLUMN IF NOT EXISTS email TEXT;

-- 7) telegram_link_tokens (new)
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 8) service_accounts (new)
CREATE TABLE IF NOT EXISTS service_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type service_account_type NOT NULL,
  telegram_id BIGINT,
  email TEXT
);
