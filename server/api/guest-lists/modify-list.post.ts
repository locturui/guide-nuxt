import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

function toDbDate(ddmmyyyy: string): string {
  const [day, month, year] = ddmmyyyy.trim().split(".");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Only agencies can modify guest lists",
    });
  }

  const body = await readBody(event);
  const { guest_list_id, guests } = body;

  if (!guest_list_id || !guests || !Array.isArray(guests)) {
    throw createError({
      statusCode: 400,
      message: "Guest list ID and guests array are required",
    });
  }

  const db = useDB();

  const [guestList] = await db.select().from(schema.guestLists).where(
    eq(schema.guestLists.id, guest_list_id),
  ).limit(1);

  if (!guestList) {
    throw createError({
      statusCode: 404,
      message: "Guest list not found",
    });
  }

  const [booking] = await db.select().from(schema.bookings).where(
    eq(schema.bookings.id, guestList.bookingId),
  ).limit(1);

  if (!booking || booking.agencyId !== auth.userId) {
    throw createError({
      statusCode: 403,
      message: "You can only modify your own guest lists",
    });
  }

  for (const guest of guests) {
    if (guest.guest_id) {
      await db
        .update(schema.guests)
        .set({
          name: guest.name,
          dateOfBirth: toDbDate(guest.date_of_birth),
          city: guest.city,
          phone: guest.phone,
          updatedAt: new Date(),
        })
        .where(eq(schema.guests.id, guest.guest_id));
    }
  }

  await db
    .update(schema.guestLists)
    .set({ updatedAt: new Date() })
    .where(eq(schema.guestLists.id, guest_list_id));

  return {
    detail: "Guest list modified successfully",
    guest_list: {
      id: guest_list_id,
      booking_id: guestList.bookingId,
      source: guestList.source,
      created_at: guestList.createdAt.toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
});
