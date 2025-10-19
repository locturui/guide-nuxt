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
    eq(schema.bookings.id, Number(booking_id)),
  ).limit(1);

  if (!booking) {
    throw createError({
      statusCode: 404,
      message: "Booking not found",
    });
  }

  const [dayCategory] = await db.select().from(schema.dayCategories).where(
    eq(schema.dayCategories.date, date),
  ).limit(1);

  const [existingSlot] = await db.select().from(schema.timeslots).where(
    and(
      eq(schema.timeslots.date, date),
      eq(schema.timeslots.time, time),
    ),
  ).limit(1);

  let timeslot = existingSlot;

  if (!timeslot) {
    const [newSlot] = await db
      .insert(schema.timeslots)
      .values({
        date,
        time,
        limit: dayCategory?.limit ?? 51,
      })
      .returning();
    timeslot = newSlot;
  }

  const existingBookings = await db.select().from(schema.bookings).where(
    and(
      eq(schema.bookings.date, date),
      eq(schema.bookings.time, time),
    ),
  );

  const booked = existingBookings
    .filter((b: any) => b.id !== booking.id && b.status !== "cancelled")
    .reduce((sum: number, b: any) => sum + b.peopleCount, 0);

  if (booked + people_count > timeslot.limit) {
    throw createError({
      statusCode: 400,
      message: `Not enough capacity. Available: ${timeslot.limit - booked}`,
    });
  }

  await db
    .update(schema.bookings)
    .set({
      date,
      time,
      peopleCount: people_count,
      preciseTime: precise_time || time,
      updatedAt: new Date(),
    })
    .where(eq(schema.bookings.id, Number(booking_id)));

  return {
    detail: "Бронирование изменено администратором",
    id: booking_id,
    date,
    time,
    people_count,
    agency_id: booking.agencyId,
    timeslot_id: `${date}|${time}`,
    precise_time: precise_time || time,
  };
});
