-- Initialize database schema
-- Run this on your Neon PostgreSQL database

-- Drop existing tables in correct order (handling foreign key dependencies)
DROP TABLE IF EXISTS guests CASCADE;
DROP TABLE IF EXISTS guest_lists CASCADE;
DROP TABLE IF EXISTS guide_assignments CASCADE;
DROP TABLE IF EXISTS guides CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS timeslots CASCADE;
DROP TABLE IF EXISTS days CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop enums if they exist
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS day_category CASCADE;
DROP TYPE IF EXISTS booking_type CASCADE;
DROP TYPE IF EXISTS guest_list_source CASCADE;

-- Create enums
CREATE TYPE user_role AS ENUM ('admin', 'agency');
CREATE TYPE day_category AS ENUM ('Open', 'Closed', 'Limited');
CREATE TYPE booking_type AS ENUM ('regular', 'joint', 'immediate');
CREATE TYPE guest_list_source AS ENUM ('manual', 'excel_import');

-- Users table (agencies and admins)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role user_role NOT NULL,
  agency_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Days table
CREATE TABLE days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  category day_category NOT NULL DEFAULT 'Open',
  "limit" INTEGER NOT NULL DEFAULT 51,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Timeslots
CREATE TABLE timeslots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
  time TIME NOT NULL,
  "limit" INTEGER,
  limited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(day_id, time)
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES users(id),
  timeslot_id UUID NOT NULL REFERENCES timeslots(id),
  people_count INTEGER NOT NULL,
  precise_time TIME,
  booking_type booking_type DEFAULT 'regular' NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'filled', 'assigned', 'cancelled')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Guides
CREATE TABLE guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  lastname TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Guide assignments
CREATE TABLE guide_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  guide_id UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Guest lists
CREATE TABLE guest_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  source guest_list_source NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Guests
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_list_id UUID NOT NULL REFERENCES guest_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  age INTEGER,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_bookings_agency_id ON bookings(agency_id);
CREATE INDEX idx_bookings_timeslot_id ON bookings(timeslot_id);
CREATE INDEX idx_timeslots_day_id ON timeslots(day_id);
CREATE INDEX idx_guides_agency_id ON guides(agency_id);
CREATE INDEX idx_guide_assignments_booking_id ON guide_assignments(booking_id);
CREATE INDEX idx_guide_assignments_guide_id ON guide_assignments(guide_id);
CREATE INDEX idx_guests_guest_list_id ON guests(guest_list_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Create default admin user (password: admin123)
INSERT INTO users (email, password, role, agency_name)
VALUES (
  'admin@example.com',
  '$2b$10$FjTeEupnRMKrhPAaWHDHpO8XSbd3TRfZEfj9g6oAhJpQu3v9tldhG', -- 'admin123' hashed with bcrypt
  'admin',
  NULL
);

-- Create a test agency user (password: agency123)
INSERT INTO users (email, password, role, agency_name)
VALUES (
  'agency@example.com',
  '$2b$10$VDqGmrqZ5YIzM/ESa/W8buzgMw9TOif0w9b.eBV3tQDA.yNcUOtB.', -- 'agency123' hashed with bcrypt
  'agency',
  'Test Agency'
);
