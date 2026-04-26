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
        db.select({ id: schema.users.id, email: schema.users.email, agencyName: schema.users.agencyName }).from(schema.users).where(
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

  const bookingIds = bookings.map(b => b.id);
  const guestLists = bookingIds.length > 0
    ? await db.select().from(schema.guestLists)
    : [];
  const assignments = bookingIds.length > 0
    ? await db.select().from(schema.guideAssignments)
    : [];
  const guestListByBookingId = new Map(guestLists.map((gl: any) => [gl.bookingId, gl]));
  const assignmentCountByBookingId = new Map<string, number>();
  assignments.forEach((a: any) => {
    assignmentCountByBookingId.set(a.bookingId, (assignmentCountByBookingId.get(a.bookingId) || 0) + 1);
  });

  const bookingsWithAgency = bookings.map(booking => ({
    ...booking,
    agency: agencyMap.get(booking.agencyId),
  }));

  const booked = bookingsWithAgency.reduce((sum: number, b: any) => sum + b.peopleCount, 0);

  const slotLimit = slotData.limit ?? day.limit;

  return {
    date,
    time,
    limit: slotLimit,
    limited: slotData.limited,
    remaining: Math.max(0, slotLimit - booked),
    total_booked: booked,
    bookings: bookingsWithAgency.map((b: any) => {
      const hasGuestList = guestListByBookingId.has(b.id);
      const assignedCount = assignmentCountByBookingId.get(b.id) || 0;
      const required = Math.max(1, Math.ceil(b.peopleCount / 17));
      let status = "booked";
      if (hasGuestList)
        status = "filled";
      if (assignedCount >= required)
        status = "assigned";
      return {
        id: String(b.id),
        people_count: b.peopleCount,
        agency_id: String(b.agencyId),
        agency_email: b.agency?.email || "Unknown",
        agency_name: b.agency?.agencyName || "Unknown",
        status,
        precise_time: b.preciseTime,
        booking_type: b.bookingType || "regular",
        is_radio: b.isRadio,
        curator_name: b.curatorName,
        driver_name: b.driverName,
      };
    }),
  };
});
