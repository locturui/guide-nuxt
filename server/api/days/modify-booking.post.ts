import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  const body = await readBody(event);
  const { booking_id, people_count, precise_time } = body;

  if (!booking_id || !people_count) {
    throw createError({
      statusCode: 400,
      message: "Booking ID and people_count are required",
    });
  }

  const db = useDB();

  const [booking] = await db.select().from(schema.bookings).where(
    eq(schema.bookings.id, Number(booking_id)),
  ).limit(1);

  if (!booking) {
    throw createError({
      statusCode: 404,
      message: "Booking not found",
    });
  }

  if (booking.agencyId !== auth.userId) {
    throw createError({
      statusCode: 403,
      message: "You can only modify your own bookings",
    });
  }

  const [timeslot] = await db.select().from(schema.timeslots).where(
    and(
      eq(schema.timeslots.date, booking.date),
      eq(schema.timeslots.time, booking.time),
    ),
  ).limit(1);

  const [dayCategory] = await db.select().from(schema.dayCategories).where(
    eq(schema.dayCategories.date, booking.date),
  ).limit(1);

  const otherBookings = await db.select().from(schema.bookings).where(
    and(
      eq(schema.bookings.date, booking.date),
      eq(schema.bookings.time, booking.time),
    ),
  );

  const slotLimit = timeslot?.limit ?? dayCategory?.limit ?? 51;
  const booked = otherBookings
    .filter((b: any) => b.id !== booking.id && b.status !== "cancelled")
    .reduce((sum: number, b: any) => sum + b.peopleCount, 0);

  if (booked + people_count > slotLimit) {
    throw createError({
      statusCode: 400,
      message: `Not enough capacity. Available: ${slotLimit - booked}`,
    });
  }

  const newPreciseTime = precise_time || booking.preciseTime || booking.time;
  await db
    .update(schema.bookings)
    .set({
      peopleCount: people_count,
      preciseTime: newPreciseTime,
      updatedAt: new Date(),
    })
    .where(eq(schema.bookings.id, Number(booking_id)));

  return {
    detail: "Бронирование изменено",
    id: booking_id,
    date: booking.date,
    time: booking.time,
    people_count,
    agency_id: booking.agencyId,
    timeslot_id: `${booking.date}|${booking.time}`, // Pseudo timeslot ID
    precise_time: newPreciseTime,
  };
});
