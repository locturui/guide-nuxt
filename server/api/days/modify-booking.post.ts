import { eq } from "drizzle-orm";

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
    eq(schema.bookings.id, booking_id),
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
    eq(schema.timeslots.id, booking.timeslotId),
  ).limit(1);

  if (!timeslot) {
    throw createError({
      statusCode: 404,
      message: "Timeslot not found",
    });
  }

  const [day] = await db.select().from(schema.days).where(
    eq(schema.days.id, timeslot.dayId),
  ).limit(1);

  if (!day) {
    throw createError({
      statusCode: 404,
      message: "Day not found",
    });
  }

  const otherBookings = await db.select().from(schema.bookings).where(
    eq(schema.bookings.timeslotId, timeslot.id),
  );

  const slotLimit = timeslot.limit ?? day.limit;
  const booked = otherBookings
    .filter((b: any) => b.id !== booking.id && b.status !== "cancelled")
    .reduce((sum: number, b: any) => sum + b.peopleCount, 0);

  if (booked + people_count > slotLimit) {
    throw createError({
      statusCode: 400,
      message: `Not enough capacity. Available: ${slotLimit - booked}`,
    });
  }

  const newPreciseTime = precise_time || booking.preciseTime || timeslot.time;
  await db
    .update(schema.bookings)
    .set({
      peopleCount: people_count,
      preciseTime: newPreciseTime,
      updatedAt: new Date(),
    })
    .where(eq(schema.bookings.id, booking_id));

  const [updatedBooking] = await db.select().from(schema.bookings).where(
    eq(schema.bookings.id, booking_id),
  ).limit(1);

  if (!updatedBooking) {
    throw createError({
      statusCode: 404,
      message: "Updated booking not found",
    });
  }

  const [updatedTimeslot] = await db.select().from(schema.timeslots).where(
    eq(schema.timeslots.id, updatedBooking.timeslotId),
  ).limit(1);

  if (!updatedTimeslot) {
    throw createError({
      statusCode: 404,
      message: "Updated timeslot not found",
    });
  }

  const [updatedDay] = await db.select().from(schema.days).where(
    eq(schema.days.id, updatedTimeslot.dayId),
  ).limit(1);

  if (!updatedDay) {
    throw createError({
      statusCode: 404,
      message: "Updated day not found",
    });
  }

  return {
    detail: "Бронирование изменено",
    id: String(updatedBooking.id),
    date: updatedDay.date,
    time: updatedTimeslot.time,
    people_count: updatedBooking.peopleCount,
    agency_id: String(updatedBooking.agencyId),
    timeslot_id: String(updatedBooking.timeslotId),
    precise_time: updatedBooking.preciseTime,
    status: updatedBooking.status,
  };
});
