import { relations } from "drizzle-orm";
import { date, integer, pgTable, serial, text, time, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'admin' | 'agent'
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dayCategories = pgTable("day_categories", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  category: text("category"),
  limit: integer("limit").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const timeslots = pgTable("timeslots", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  time: time("time").notNull(),
  limit: integer("limit").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  agencyId: uuid("agency_id").references(() => users.id).notNull(),
  date: date("date").notNull(),
  time: time("time").notNull(),
  peopleCount: integer("people_count").notNull(),
  preciseTime: text("precise_time"),
  status: text("status").default("pending").notNull(), // 'pending' | 'filled' | 'assigned' | 'cancelled'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const guides = pgTable("guides", {
  id: uuid("id").defaultRandom().primaryKey(),
  agencyId: uuid("agency_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  lastname: text("lastname").notNull(),
  badgeNumber: text("badge_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const guideAssignments = pgTable("guide_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id).notNull(),
  guideId: uuid("guide_id").references(() => guides.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const guestLists = pgTable("guest_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id).notNull().unique(),
  source: text("source").notNull(), // 'manual' | 'excel'
  previewId: text("preview_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const guests = pgTable("guests", {
  id: uuid("id").defaultRandom().primaryKey(),
  guestListId: uuid("guest_list_id").references(() => guestLists.id).notNull(),
  name: text("name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  city: text("city").notNull(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many: _many }) => ({
  bookings: _many(bookings),
  guides: _many(guides),
}));

export const bookingsRelations = relations(bookings, ({ one, many: _many }) => ({
  agency: one(users, {
    fields: [bookings.agencyId],
    references: [users.id],
  }),
  guestList: one(guestLists),
  guideAssignment: one(guideAssignments),
}));

export const guidesRelations = relations(guides, ({ one, many: _many }) => ({
  agency: one(users, {
    fields: [guides.agencyId],
    references: [users.id],
  }),
  assignments: _many(guideAssignments),
}));

export const guideAssignmentsRelations = relations(guideAssignments, ({ one }) => ({
  booking: one(bookings, {
    fields: [guideAssignments.bookingId],
    references: [bookings.id],
  }),
  guide: one(guides, {
    fields: [guideAssignments.guideId],
    references: [guides.id],
  }),
}));

export const guestListsRelations = relations(guestLists, ({ one, many }) => ({
  booking: one(bookings, {
    fields: [guestLists.bookingId],
    references: [bookings.id],
  }),
  guests: many(guests),
}));

export const guestsRelations = relations(guests, ({ one }) => ({
  guestList: one(guestLists, {
    fields: [guests.guestListId],
    references: [guestLists.id],
  }),
}));
