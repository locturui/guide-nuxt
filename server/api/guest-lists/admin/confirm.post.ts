import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";
import { normalizePhoneNumber, parseDateOfBirthToAge } from "~/server/utils/guest-validation";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { booking_id, guests } = body;

  if (!booking_id || !guests || !Array.isArray(guests)) {
    throw createError({
      statusCode: 400,
      message: "Booking ID and guests array are required",
    });
  }

  const db = useDB();

  const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, booking_id),
  ).limit(1);

  if (!booking) {
    throw createError({
      statusCode: 404,
      message: "Booking not found",
    });
  }

  const [existingList] = await db.select().from(schema.guestLists).where(
    eq(schema.guestLists.bookingId, booking_id),
  ).limit(1);

  let guestList = existingList;

  if (guestList) {
    await db.delete(schema.guests).where(eq(schema.guests.guestListId, guestList.id));
  }
  else {
    [guestList] = await db
      .insert(schema.guestLists)
      .values({
        bookingId: booking_id,
        source: "manual",
      })
      .returning();
  }

  const guestsToInsert = guests.map(guest => ({
    guestListId: guestList.id,
    name: guest.name.trim(),
    dateOfBirth: guest.date_of_birth.trim(),
    age: parseDateOfBirthToAge(guest.date_of_birth),
    city: guest.city.trim(),
    phone: normalizePhoneNumber(guest.phone),
  }));

  const createdGuests = guestsToInsert.length > 0
    ? await db.insert(schema.guests).values(guestsToInsert).returning()
    : [];

  await db
    .update(schema.bookings)
    .set({ status: "filled" })
    .where(eq(schema.bookings.id, booking_id));

  return {
    booking_id,
    guests: createdGuests.map(g => ({
      name: g.name,
      date_of_birth: g.dateOfBirth,
      city: g.city,
      phone: g.phone,
      errors: [],
    })),
    errors: [],
    guest_list: {
      id: guestList.id,
      booking_id,
      source: guestList.source,
      created_at: guestList.createdAt.toISOString(),
      updated_at: guestList.updatedAt.toISOString(),
      guests: createdGuests.map(g => ({
        id: g.id,
        name: g.name,
        date_of_birth: g.dateOfBirth,
        age: g.age,
        city: g.city,
        phone: g.phone,
        created_at: g.createdAt.toISOString(),
        updated_at: g.updatedAt.toISOString(),
      })),
    },
  };
});
