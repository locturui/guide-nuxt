import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

function toFrontendDate(yyyymmdd: string): string {
  const [year, month, day] = yyyymmdd.split("-");
  return `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
}

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  const body = await readBody(event);
  const { booking_id } = body;

  if (!booking_id) {
    throw createError({
      statusCode: 400,
      message: "Booking ID is required",
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

  if (auth.role === "agency" && booking.agencyId !== auth.userId) {
    throw createError({
      statusCode: 403,
      message: "You can only view guest lists for your own bookings",
    });
  }

  const [guestList] = await db.select().from(schema.guestLists).where(
    eq(schema.guestLists.bookingId, Number(booking_id)),
  ).limit(1);

  if (!guestList) {
    throw createError({
      statusCode: 404,
      message: "Guest list not found",
    });
  }

  const guests = await db.select().from(schema.guests).where(
    eq(schema.guests.guestListId, guestList.id),
  );

  const [guideAssignment] = await db.select().from(schema.guideAssignments).where(
    eq(schema.guideAssignments.bookingId, Number(booking_id)),
  ).limit(1);

  return {
    guest_list: {
      id: guestList.id,
      booking_id,
      source: guestList.source,
      created_at: guestList.createdAt.toISOString(),
      updated_at: guestList.updatedAt.toISOString(),
      guide_id: guideAssignment?.guideId || null,
      guests: guests.map(g => ({
        id: g.id,
        name: g.name,
        date_of_birth: toFrontendDate(g.dateOfBirth),
        age: calculateAge(g.dateOfBirth),
        city: g.city,
        phone: g.phone,
        created_at: g.createdAt.toISOString(),
        updated_at: g.updatedAt.toISOString(),
      })),
    },
  };
});

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}
