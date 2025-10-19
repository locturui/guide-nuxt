import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

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

  await db.delete(schema.bookings).where(eq(schema.bookings.id, Number(booking_id)));

  return {
    detail: "Booking cancelled by admin",
  };
});
