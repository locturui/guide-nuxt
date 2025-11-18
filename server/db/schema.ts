import { relations } from "drizzle-orm";
import { boolean, date, integer, pgEnum, pgTable, text, time, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "agency"]);
export const dayCategoryEnum = pgEnum("day_category", ["Open", "Closed", "Limited"]);
export const bookingTypeEnum = pgEnum("booking_type", ["regular", "joint", "immediate"]);
export const guestListSourceEnum = pgEnum("guest_list_source", ["manual", "excel_import"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull(),
  agencyName: text("agency_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const days = pgTable("days", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull().unique(),
  category: dayCategoryEnum("category").notNull().default("Open"),
  limit: integer("limit").notNull().default(51),
});

export const timeslots = pgTable("timeslots", {
  id: uuid("id").defaultRandom().primaryKey(),
  dayId: uuid("day_id").references(() => days.id).notNull(),
  time: time("time").notNull(),
  limit: integer("limit"),
  limited: boolean("limited").default(false).notNull(),
});

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  agencyId: uuid("agency_id").references(() => users.id).notNull(),
  timeslotId: uuid("timeslot_id").references(() => timeslots.id).notNull(),
  peopleCount: integer("people_count").notNull(),
  preciseTime: time("precise_time"),
  bookingType: bookingTypeEnum("booking_type").default("regular").notNull(),
  status: text("status").default("booked").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const guides = pgTable("guides", {
  id: uuid("id").defaultRandom().primaryKey(),
  agencyId: uuid("agency_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  lastname: text("lastname").notNull(),
});

export const guideAssignments = pgTable("guide_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
  guideId: uuid("guide_id").references(() => guides.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const guestLists = pgTable("guest_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
  source: guestListSourceEnum("source").notNull().default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const guests = pgTable("guests", {
  id: uuid("id").defaultRandom().primaryKey(),
  guestListId: uuid("guest_list_id").references(() => guestLists.id).notNull(),
  name: text("name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  age: integer("age").notNull(),
  city: text("city").notNull(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  guides: many(guides),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const daysRelations = relations(days, ({ many }) => ({
  timeslots: many(timeslots),
}));

export const timeslotsRelations = relations(timeslots, ({ one, many }) => ({
  day: one(days, {
    fields: [timeslots.dayId],
    references: [days.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  agency: one(users, {
    fields: [bookings.agencyId],
    references: [users.id],
  }),
  timeslot: one(timeslots, {
    fields: [bookings.timeslotId],
    references: [timeslots.id],
  }),
  guestList: one(guestLists),
  guideAssignments: many(guideAssignments),
}));

export const guidesRelations = relations(guides, ({ one, many }) => ({
  agency: one(users, {
    fields: [guides.agencyId],
    references: [users.id],
  }),
  assignments: many(guideAssignments),
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
