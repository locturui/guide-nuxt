import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Booking ID is required",
    });
  }

  const db = useDB();

  const [guestList] = await db.select().from(schema.guestLists).where(
    eq(schema.guestLists.bookingId, Number(id)),
  ).limit(1);

  if (!guestList) {
    throw createError({
      statusCode: 404,
      message: "Guest list not found",
    });
  }

  await db.delete(schema.guestLists).where(eq(schema.guestLists.id, guestList.id));

  await db
    .update(schema.bookings)
    .set({ status: "pending" })
    .where(eq(schema.bookings.id, Number(id)));

  return {
    detail: "Guest list deleted successfully",
  };
});
