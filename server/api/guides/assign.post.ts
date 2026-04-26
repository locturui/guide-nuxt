import { and, eq } from "drizzle-orm";

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

  const [guide] = await db.select().from(schema.guides).where(
    and(eq(schema.guides.id, guide_id), eq(schema.guides.removed, false)),
  ).limit(1);

  if (!guide || guide.agencyId !== auth.userId) {
    throw createError({
      statusCode: 404,
      message: "Гид не найден или не принадлежит вашему агентству",
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

  const existingForGuide = await db.select().from(schema.guideAssignments).where(
    and(eq(schema.guideAssignments.bookingId, booking_id), eq(schema.guideAssignments.guideId, guide_id)),
  ).limit(1);

  if (existingForGuide.length > 0) {
    throw createError({
      statusCode: 400,
      message: "Гид уже назначен на это бронирование",
    });
  }

  const [assignment] = await db
    .insert(schema.guideAssignments)
    .values({
      bookingId: booking_id,
      guideId: guide_id,
    })
    .returning();

  const allAssignments = await db.select().from(schema.guideAssignments).where(eq(schema.guideAssignments.bookingId, booking_id));
  const assignedCount = allAssignments.length;
  const required = Math.max(1, Math.ceil(booking.peopleCount / 17));

  return {
    detail: `Гид успешно назначен на бронирование. Назначено гидов: ${assignedCount}/${required}.`,
    assignment_id: assignment.id,
    booking_id,
    guide_id,
    guide_name: `${guide.name}`,
    guide_lastname: guide.lastname,
    created_at: assignment.createdAt.toISOString(),
  };
});
