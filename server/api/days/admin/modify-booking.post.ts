import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { booking_id, date, time, people_count, precise_time } = body;

  if (!booking_id || !date || !time || !people_count) {
    throw createError({
      statusCode: 400,
      message: "Booking ID, date, time, and people_count are required",
    });
  }

  const db = useDB();

  const [booking] = await db.select().from(schema.bookings).where(
    eq(schema.bookings.id, booking_id),
  ).limit(1);

  if (!booking) {
    throw createError({
      statusCode: 404,
      message: "Booking not found",
    });
  }

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
    [timeslot] = await db
      .insert(schema.timeslots)
      .values({
        dayId: day.id,
        time,
        limit: day.limit,
        limited: false,
      })
      .returning();
  }

  const existingBookings = await db.select().from(schema.bookings).where(
    eq(schema.bookings.timeslotId, timeslot.id),
  );

  const booked = existingBookings
    .filter((b: any) => b.id !== booking.id && b.status !== "cancelled")
    .reduce((sum: number, b: any) => sum + b.peopleCount, 0);

  const slotLimit = timeslot.limit ?? day.limit;

  if (booked + people_count > slotLimit) {
    throw createError({
      statusCode: 400,
      message: `Not enough capacity. Available: ${slotLimit - booked}`,
    });
  }

  const newPreciseTime = precise_time || time;

  await db
    .update(schema.bookings)
    .set({
      timeslotId: timeslot.id,
      peopleCount: people_count,
      preciseTime: newPreciseTime,
      updatedAt: new Date(),
    })
    .where(eq(schema.bookings.id, booking_id));

  const [updatedBooking] = await db.select().from(schema.bookings).where(
    eq(schema.bookings.id, booking_id),
  ).limit(1);

  return {
    detail: "Бронирование изменено администратором",
    id: String(updatedBooking.id),
    date,
    time,
    people_count: updatedBooking.peopleCount,
    agency_id: String(updatedBooking.agencyId),
    timeslot_id: String(updatedBooking.timeslotId),
    precise_time: updatedBooking.preciseTime,
    status: updatedBooking.status,
  };
});
