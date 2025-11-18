import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Only agencies can assign guides",
    });
  }

  const body = await readBody(event);
  const { booking_id, guide_id } = body;

  if (!booking_id || !guide_id) {
    throw createError({
      statusCode: 400,
      message: "Booking ID and guide ID are required",
    });
  }

  const db = useDB();

  const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, booking_id),
  ).limit(1);

  if (!booking || booking.agencyId !== auth.userId) {
    throw createError({
      statusCode: 404,
      message: "Booking not found or doesn't belong to your agency",
    });
  }

  const [guide] = await db.select().from(schema.guides).where(eq(schema.guides.id, guide_id),
  ).limit(1);

  if (!guide || guide.agencyId !== auth.userId) {
    throw createError({
      statusCode: 404,
      message: "Guide not found or doesn't belong to your agency",
    });
  }

  const [guestList] = await db.select().from(schema.guestLists).where(eq(schema.guestLists.bookingId, booking_id),
  ).limit(1);

  if (!guestList) {
    throw createError({
      statusCode: 400,
      message: "Cannot assign guide to booking without guest list",
    });
  }

  const [existingAssignment] = await db.select().from(schema.guideAssignments).where(eq(schema.guideAssignments.bookingId, booking_id),
  ).limit(1);

  if (existingAssignment) {
    throw createError({
      statusCode: 400,
      message: "Guide already assigned to this booking",
    });
  }

  const [assignment] = await db
    .insert(schema.guideAssignments)
    .values({
      bookingId: booking_id,
      guideId: guide_id,
    })
    .returning();

  await db
    .update(schema.bookings)
    .set({ status: "assigned" })
    .where(eq(schema.bookings.id, booking_id));

  return {
    detail: "Гид успешно назначен на бронирование",
    assignment_id: assignment.id,
    booking_id,
    guide_id,
    guide_name: `${guide.name}`,
    guide_lastname: guide.lastname,
    created_at: assignment.createdAt.toISOString(),
  };
});
