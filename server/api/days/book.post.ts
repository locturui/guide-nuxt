import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";
import { isBookingAllowed } from "~/server/utils/validation";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Only agencies can create bookings",
    });
  }

  const body = await readBody(event);
  const { date, time, people_count, precise_time, is_joint } = body;

  if (!date || !time || !people_count) {
    throw createError({
      statusCode: 400,
      message: "Date, time, and people_count are required",
    });
  }

  if (!isBookingAllowed(date, time)) {
    throw createError({
      statusCode: 400,
      message: "Cannot book in the past",
    });
  }

  const db = useDB();

  let [day] = await db.select().from(schema.days).where(
    eq(schema.days.date, date),
  ).limit(1);

  if (!day) {
    [day] = await db
      .insert(schema.days)
      .values({
        date,
        category: "Open",
        limit: 51,
      })
      .returning();
  }

  let [timeslot] = await db.select().from(schema.timeslots).where(
    and(
      eq(schema.timeslots.dayId, day.id),
      eq(schema.timeslots.time, time),
    ),
  ).limit(1);

  if (!timeslot) {
    const defaultLimit = (time.startsWith("08:") || time.startsWith("08:")) ? 0 : day.limit;
    [timeslot] = await db
      .insert(schema.timeslots)
      .values({
        dayId: day.id,
        time,
        limit: defaultLimit,
        limited: false,
      })
      .returning();
  }

  const existingBookings = await db.select().from(schema.bookings).where(
    eq(schema.bookings.timeslotId, timeslot.id),
  );

  const booked = existingBookings.reduce((sum: number, b: any) => sum + b.peopleCount, 0);
  const slotLimit = timeslot.limit ?? day.limit;

  if (booked + people_count > slotLimit) {
    throw createError({
      statusCode: 400,
      message: `Not enough capacity. Available: ${slotLimit - booked}`,
    });
  }

  const preciseTimeValue = precise_time || time;
  const bookingType = is_joint ? "joint" : "regular";

  const [booking] = await db
    .insert(schema.bookings)
    .values({
      agencyId: auth.userId,
      timeslotId: timeslot.id,
      peopleCount: people_count,
      preciseTime: preciseTimeValue,
      bookingType: bookingType as "regular" | "joint" | "immediate",
    })
    .returning();

  const status = "booked";

  return {
    id: String(booking.id),
    date,
    time,
    people_count: booking.peopleCount,
    agency_id: booking.agencyId,
    timeslot_id: String(booking.timeslotId),
    precise_time: booking.preciseTime,
    booking_type: booking.bookingType,
    status,
  };
});
