import { and, gte, lte } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";
import { getWeekDates } from "~/server/utils/date";

function generateAllTimes(): string[] {
  const times: string[] = [];
  for (let h = 9; h < 20; h++) {
    for (const m of [0, 30]) {
      if (h === 19 && m === 30)
        continue; // Stop at 19:30
      times.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  return times;
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const query = getQuery(event);
  const dateStr = query.date as string;

  if (!dateStr) {
    throw createError({
      statusCode: 400,
      message: "Date parameter is required",
    });
  }

  const startDate = new Date(dateStr);
  const weekDates = getWeekDates(startDate);
  const startDateStr = weekDates[0];
  const endDateStr = weekDates[6];

  const db = useDB();

  const [dayCategories, timeslots, bookings, users, guestLists, guideAssignments] = await Promise.all([
    db.select().from(schema.dayCategories).where(
      and(
        gte(schema.dayCategories.date, startDateStr),
        lte(schema.dayCategories.date, endDateStr),
      ),
    ),
    db.select().from(schema.timeslots).where(
      and(
        gte(schema.timeslots.date, startDateStr),
        lte(schema.timeslots.date, endDateStr),
      ),
    ),
    db.select().from(schema.bookings).where(
      and(
        gte(schema.bookings.date, startDateStr),
        lte(schema.bookings.date, endDateStr),
      ),
    ),
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users),
    db.select().from(schema.guestLists),
    db.select().from(schema.guideAssignments),
  ]);

  const userMap = new Map();
  users.forEach((u: any) => {
    userMap.set(u.id, u);
  });

  const dayCategoryMap = new Map();
  dayCategories.forEach((dc: any) => {
    dayCategoryMap.set(dc.date, dc);
  });

  const timeslotMap = new Map();
  timeslots.forEach((ts: any) => {
    const key = `${ts.date}|${ts.time.substring(0, 5)}`;
    timeslotMap.set(key, ts);
  });

  const bookingsBySlot = new Map();
  bookings.forEach((booking: any) => {
    const key = `${booking.date}|${booking.time.substring(0, 5)}`;
    if (!bookingsBySlot.has(key)) {
      bookingsBySlot.set(key, []);
    }
    bookingsBySlot.get(key)!.push(booking);
  });

  const guestListByBookingId = new Map();
  guestLists.forEach((gl: any) => {
    guestListByBookingId.set(gl.bookingId, gl);
  });

  const guideAssignmentByBookingId = new Map();
  guideAssignments.forEach((ga: any) => {
    guideAssignmentByBookingId.set(ga.bookingId, ga);
  });

  const allTimes = generateAllTimes();
  const result = weekDates.map((dateStr) => {
    const dayCategory = dayCategoryMap.get(dateStr);
    const dayLimit = dayCategory?.limit ?? 51;
    const category = dayCategory?.category ?? "open";

    const timeslots = allTimes.map((timeStr) => {
      const key = `${dateStr}|${timeStr}`;
      const slot = timeslotMap.get(key);
      const slotBookings = bookingsBySlot.get(key) || [];

      const limit = slot?.limit ?? dayLimit;
      const booked = slotBookings
        .filter((b: any) => b.status !== "cancelled")
        .reduce((sum: number, b: any) => sum + b.peopleCount, 0);

      return {
        time: timeStr,
        limit,
        remaining: Math.max(0, limit - booked),
        bookings: slotBookings.map((b: any) => {
          const hasGuestList = guestListByBookingId.has(b.id);
          const hasGuide = guideAssignmentByBookingId.has(b.id);

          let bookingStatus = "booked";
          if (hasGuestList)
            bookingStatus = "filled";
          if (hasGuide)
            bookingStatus = "assigned";

          const agency = userMap.get(b.agencyId);

          return {
            id: b.id,
            people_count: b.peopleCount,
            agency_id: b.agencyId,
            agency_name: agency?.name || "Unknown",
            status: bookingStatus,
            precise_time: b.preciseTime,
          };
        }),
      };
    });

    return {
      date: dateStr,
      category,
      limit: dayLimit,
      timeslots,
    };
  });

  return result;
});
