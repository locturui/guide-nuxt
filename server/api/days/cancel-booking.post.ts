import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

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
      message: "You can only cancel your own bookings",
    });
  }

  await db.delete(schema.bookings).where(eq(schema.bookings.id, booking_id));

  return {
    detail: "Booking cancelled",
  };
});
