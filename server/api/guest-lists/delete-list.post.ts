import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Only agencies can delete guest lists",
    });
  }

  const body = await readBody(event);
  const { guest_list_id } = body;

  if (!guest_list_id) {
    throw createError({
      statusCode: 400,
      message: "Guest list ID is required",
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
      message: "You can only delete your own guest lists",
    });
  }

  await db.delete(schema.guestLists).where(eq(schema.guestLists.id, guest_list_id));

  await db
    .update(schema.bookings)
    .set({ status: "pending" })
    .where(eq(schema.bookings.id, guestList.bookingId));

  return {
    detail: "Guest list deleted successfully",
  };
});
