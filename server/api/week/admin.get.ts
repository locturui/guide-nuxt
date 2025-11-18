import { and, eq, gte, inArray, lte } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";
import { getWeekDates } from "~/server/utils/date";

function generateAllTimes(): string[] {
  const times: string[] = [];
  for (let h = 9; h < 20; h++) {
    for (const m of [0, 30]) {
      if (h === 19 && m === 30)
        continue;
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

  const days = await db.select().from(schema.days).where(
    and(
      gte(schema.days.date, startDateStr),
      lte(schema.days.date, endDateStr),
    ),
  );

  const dayIds = days.map(d => d.id);
  const dayMap = new Map(days.map(d => [d.id, d]));

  const filteredTimeslots = dayIds.length > 0
    ? dayIds.length === 1
      ? await db.select().from(schema.timeslots).where(
          eq(schema.timeslots.dayId, dayIds[0]),
        )
      : await db.select().from(schema.timeslots).where(
          inArray(schema.timeslots.dayId, dayIds),
        )
    : [];

  const timeslotIds = filteredTimeslots.map(ts => ts.id);
  const [allBookings, users, guestLists, guideAssignments] = await Promise.all([
    timeslotIds.length > 0
      ? db.select().from(schema.bookings).where(
          inArray(schema.bookings.timeslotId, timeslotIds),
        )
      : [],
    db.select({ id: schema.users.id, agencyName: schema.users.agencyName }).from(schema.users),
    db.select().from(schema.guestLists),
    db.select().from(schema.guideAssignments),
  ]);

  const userMap = new Map();
  users.forEach((u: any) => {
    userMap.set(u.id, u);
  });

  const dayMapForDate = new Map(days.map(d => [d.date, d]));

  const timeslotMap = new Map();
  filteredTimeslots.forEach((ts: any) => {
    const day = dayMap.get(ts.dayId);
    if (day) {
      const timeStr = typeof ts.time === "string" ? ts.time.substring(0, 5) : `${String(ts.time.hours || 0).padStart(2, "0")}:${String(ts.time.minutes || 0).padStart(2, "0")}`;
      const key = `${day.date}|${timeStr}`;
      timeslotMap.set(key, { ...ts, dayDate: day.date, timeStr });
    }
  });

  const timeslotByIdMap = new Map(filteredTimeslots.map(ts => [ts.id, ts]));

  const bookingsBySlot = new Map();
  allBookings.forEach((booking: any) => {
    const ts = timeslotByIdMap.get(booking.timeslotId);
    if (ts) {
      const day = dayMap.get(ts.dayId);
      if (day) {
        const timeStr = typeof ts.time === "string" ? ts.time.substring(0, 5) : `${String(ts.time.hours || 0).padStart(2, "0")}:${String(ts.time.minutes || 0).padStart(2, "0")}`;
        const key = `${day.date}|${timeStr}`;
        if (!bookingsBySlot.has(key)) {
          bookingsBySlot.set(key, []);
        }
        bookingsBySlot.get(key)!.push({ ...booking, date: day.date, time: timeStr });
      }
    }
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
    const day = dayMapForDate.get(dateStr);
    const dayLimit = day?.limit ?? 51;
    const category = day?.category ?? "Open";

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

          let bookingStatus = b.status || "booked";
          if (hasGuestList && bookingStatus === "booked")
            bookingStatus = "filled";
          if (hasGuide)
            bookingStatus = "assigned";

          const agency = userMap.get(b.agencyId);

          return {
            id: String(b.id),
            people_count: b.peopleCount,
            agency_id: String(b.agencyId),
            agency_name: agency?.agencyName || "Unknown",
            status: bookingStatus,
            precise_time: b.preciseTime || b.time,
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
