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
  const { date, time, people_count, precise_time } = body;

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

  const [dayCategory] = await db.select().from(schema.dayCategories).where(
    eq(schema.dayCategories.date, date),
  ).limit(1);

  const [timeslot] = await db.select().from(schema.timeslots).where(
    and(
      eq(schema.timeslots.date, date),
      eq(schema.timeslots.time, time),
    ),
  ).limit(1);

  let slot = timeslot;

  if (!slot) {
    const [newSlot] = await db
      .insert(schema.timeslots)
      .values({
        date,
        time,
        limit: dayCategory?.limit ?? 51,
      })
      .returning();
    slot = newSlot;
  }

  const existingBookings = await db.select().from(schema.bookings).where(
    and(
      eq(schema.bookings.date, date),
      eq(schema.bookings.time, time),
    ),
  );

  const booked = existingBookings
    .filter((b: any) => b.status !== "cancelled")
    .reduce((sum: number, b: any) => sum + b.peopleCount, 0);

  if (booked + people_count > slot.limit) {
    throw createError({
      statusCode: 400,
      message: `Not enough capacity. Available: ${slot.limit - booked}`,
    });
  }

  const [booking] = await db
    .insert(schema.bookings)
    .values({
      agencyId: auth.userId,
      date,
      time,
      peopleCount: people_count,
      preciseTime: precise_time || time,
      status: "pending",
    })
    .returning();

  return {
    id: String(booking.id),
    date: booking.date,
    time: booking.time,
    people_count: booking.peopleCount,
    agency_id: booking.agencyId,
    timeslot_id: `${booking.date}|${booking.time}`,
    precise_time: booking.preciseTime,
  };
});
