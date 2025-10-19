import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { date, time } = body;

  if (!date || !time) {
    throw createError({
      statusCode: 400,
      message: "Date and time are required",
    });
  }

  const db = useDB();

  const [timeslot] = await db.select().from(schema.timeslots).where(
    and(
      eq(schema.timeslots.date, date),
      eq(schema.timeslots.time, time),
    ),
  ).limit(1);

  let slotData = timeslot;

  if (!slotData) {
    const [newSlot] = await db
      .insert(schema.timeslots)
      .values({
        date,
        time,
        limit: 51,
      })
      .returning();
    slotData = newSlot;
  }

  const bookings = await db.select().from(schema.bookings).where(
    and(
      eq(schema.bookings.date, date),
      eq(schema.bookings.time, time),
    ),
  );

  const bookingsWithAgency = await Promise.all(
    bookings.map(async (booking) => {
      const [agency] = await db.select().from(schema.users).where(
        eq(schema.users.id, booking.agencyId),
      ).limit(1);
      return { ...booking, agency };
    }),
  );

  const booked = bookingsWithAgency
    .filter((b: any) => b.status !== "cancelled")
    .reduce((sum: number, b: any) => sum + b.peopleCount, 0);

  return {
    date,
    time,
    limit: slotData.limit,
    remaining: Math.max(0, slotData.limit - booked),
    booked,
    bookings: bookingsWithAgency.map((b: any) => ({
      id: b.id,
      people_count: b.peopleCount,
      agency_id: b.agencyId,
      agency_name: b.agency?.name || "Unknown",
      status: b.status,
      precise_time: b.preciseTime,
    })),
  };
});
