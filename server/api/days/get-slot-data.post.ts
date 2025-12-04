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

  const [timeslot] = await db.select().from(schema.timeslots).where(
    and(
      eq(schema.timeslots.dayId, day.id),
      eq(schema.timeslots.time, time),
    ),
  ).limit(1);

  let slotData = timeslot;

  if (!slotData) {
    [slotData] = await db
      .insert(schema.timeslots)
      .values({
        dayId: day.id,
        time,
        limit: day.limit,
        limited: false,
      })
      .returning();
  }

  const bookings = await db.select().from(schema.bookings).where(
    eq(schema.bookings.timeslotId, slotData.id),
  );

  const agencyIds = [...new Set(bookings.map(b => b.agencyId))];

  const allAgencies = agencyIds.length > 0
    ? await Promise.all(agencyIds.map(id =>
        db.select({ id: schema.users.id, agencyName: schema.users.agencyName }).from(schema.users).where(
          eq(schema.users.id, id),
        ).limit(1),
      ))
    : [];

  const agencyMap = new Map();
  allAgencies.forEach((arr) => {
    const agency = arr[0];
    if (agency) {
      agencyMap.set(agency.id, agency);
    }
  });

  const bookingsWithAgency = bookings.map(booking => ({
    ...booking,
    agency: agencyMap.get(booking.agencyId),
  }));

  const booked = bookingsWithAgency
    .filter((b: any) => b.status !== "cancelled")
    .reduce((sum: number, b: any) => sum + b.peopleCount, 0);

  const slotLimit = slotData.limit ?? day.limit;

  return {
    date,
    time,
    limit: slotLimit,
    remaining: Math.max(0, slotLimit - booked),
    booked,
    bookings: bookingsWithAgency.map((b: any) => ({
      id: String(b.id),
      people_count: b.peopleCount,
      agency_id: String(b.agencyId),
      agency_name: b.agency?.agencyName || "Unknown",
      status: b.status,
      precise_time: b.preciseTime,
      booking_type: b.bookingType || "regular",
    })),
  };
});
