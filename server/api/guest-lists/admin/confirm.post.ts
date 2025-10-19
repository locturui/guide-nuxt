import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

function toDbDate(ddmmyyyy: string): string {
  const [day, month, year] = ddmmyyyy.trim().split(".");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function toFrontendDate(yyyymmdd: string): string {
  const [year, month, day] = yyyymmdd.split("-");
  return `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
}

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

  const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, Number(booking_id)),
  ).limit(1);

  if (!booking) {
    throw createError({
      statusCode: 404,
      message: "Booking not found",
    });
  }

  const [existingList] = await db.select().from(schema.guestLists).where(
    eq(schema.guestLists.bookingId, Number(booking_id)),
  ).limit(1);

  let guestList = existingList;

  if (guestList) {
    await db.delete(schema.guests).where(eq(schema.guests.guestListId, guestList.id));
  }
  else {
    [guestList] = await db
      .insert(schema.guestLists)
      .values({
        bookingId: Number(booking_id),
        source: "manual",
      })
      .returning();
  }

  const createdGuests = [];
  for (const guest of guests) {
    const [created] = await db
      .insert(schema.guests)
      .values({
        guestListId: guestList.id,
        name: guest.name,
        dateOfBirth: toDbDate(guest.date_of_birth),
        city: guest.city,
        phone: guest.phone,
      })
      .returning();
    createdGuests.push(created);
  }

  await db
    .update(schema.bookings)
    .set({ status: "filled" })
    .where(eq(schema.bookings.id, Number(booking_id)));

  return {
    booking_id,
    guests: createdGuests.map(g => ({
      name: g.name,
      date_of_birth: toFrontendDate(g.dateOfBirth),
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
