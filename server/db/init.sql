-- Initialize database schema
-- Run this on your Neon PostgreSQL database

-- Users table (agencies and admins)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'agency')),
  name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Day categories
CREATE TABLE IF NOT EXISTS day_categories (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  category TEXT,
  "limit" INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Timeslots
CREATE TABLE IF NOT EXISTS timeslots (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  time TIME NOT NULL,
  "limit" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(date, time)
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  time TIME NOT NULL,
  people_count INTEGER NOT NULL,
  precise_time TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'assigned', 'cancelled')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Guides
CREATE TABLE IF NOT EXISTS guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  lastname TEXT NOT NULL,
  badge_number TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Guide assignments
CREATE TABLE IF NOT EXISTS guide_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  guide_id UUID NOT NULL REFERENCES guides(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Guest lists
CREATE TABLE IF NOT EXISTS guest_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id),
  source TEXT NOT NULL CHECK (source IN ('manual', 'excel')),
  preview_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Guests
CREATE TABLE IF NOT EXISTS guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_list_id UUID NOT NULL REFERENCES guest_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_agency_id ON bookings(agency_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_timeslots_date ON timeslots(date);
CREATE INDEX IF NOT EXISTS idx_guides_agency_id ON guides(agency_id);
CREATE INDEX IF NOT EXISTS idx_guide_assignments_booking_id ON guide_assignments(booking_id);
CREATE INDEX IF NOT EXISTS idx_guide_assignments_guide_id ON guide_assignments(guide_id);
CREATE INDEX IF NOT EXISTS idx_guests_guest_list_id ON guests(guest_list_id);

-- Clear all data first
TRUNCATE TABLE guests CASCADE;
TRUNCATE TABLE guest_lists CASCADE;
TRUNCATE TABLE guide_assignments CASCADE;
TRUNCATE TABLE guides CASCADE;
TRUNCATE TABLE bookings CASCADE;
TRUNCATE TABLE timeslots CASCADE;
TRUNCATE TABLE day_categories CASCADE;
TRUNCATE TABLE users CASCADE;

-- Create default admin user (password: admin123)
INSERT INTO users (email, password, role, name)
VALUES (
  'admin@example.com',
  '$2b$10$FjTeEupnRMKrhPAaWHDHpO8XSbd3TRfZEfj9g6oAhJpQu3v9tldhG', -- 'admin123' hashed with bcrypt
  'admin',
  'Admin User'
);

-- Create a test agency user (password: agency123)
INSERT INTO users (email, password, role, name)
VALUES (
  'agency@example.com',
  '$2b$10$VDqGmrqZ5YIzM/ESa/W8buzgMw9TOif0w9b.eBV3tQDA.yNcUOtB.', -- 'agency123' hashed with bcrypt
  'agency',
  'Test Agency'
);

