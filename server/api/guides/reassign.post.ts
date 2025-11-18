import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency" && auth.role !== "admin") {
    throw createError({
      statusCode: 403,
      message: "Недостаточно прав для смены гида",
    });
  }

  const body = await readBody(event);
  const { booking_id, old_guide_id, new_guide_id } = body;

  if (!booking_id || !old_guide_id || !new_guide_id) {
    throw createError({
      statusCode: 400,
      message: "Booking ID, old guide ID, and new guide ID are required",
    });
  }

  const db = useDB();

  let booking;
  if (auth.role === "agency") {
    [booking] = await db.select().from(schema.bookings).where(
      and(
        eq(schema.bookings.id, booking_id),
        eq(schema.bookings.agencyId, auth.userId),
      ),
    ).limit(1);
  }
  else {
    [booking] = await db.select().from(schema.bookings).where(
      eq(schema.bookings.id, booking_id),
    ).limit(1);
  }

  if (!booking) {
    throw createError({
      statusCode: 404,
      message: "Бронирование не найдено или не принадлежит вашему агентству",
    });
  }

  const [timeslot] = await db.select().from(schema.timeslots).where(
    eq(schema.timeslots.id, booking.timeslotId),
  ).limit(1);

  if (timeslot) {
    const [day] = await db.select().from(schema.days).where(
      eq(schema.days.id, timeslot.dayId),
    ).limit(1);

    if (day) {
      const startTime = booking.preciseTime || timeslot.time;
      const startDateTime = new Date(`${day.date}T${startTime}`);
      const now = new Date();

      if (now >= startDateTime) {
        throw createError({
          statusCode: 400,
          message: "Нельзя изменить гида после начала экскурсии",
        });
      }
    }
  }

  let newGuide;
  if (auth.role === "agency") {
    [newGuide] = await db.select().from(schema.guides).where(
      and(
        eq(schema.guides.id, new_guide_id),
        eq(schema.guides.agencyId, auth.userId),
      ),
    ).limit(1);
  }
  else {
    [newGuide] = await db.select().from(schema.guides).where(
      eq(schema.guides.id, new_guide_id),
    ).limit(1);
  }

  if (!newGuide) {
    throw createError({
      statusCode: 404,
      message: "Новый гид не найден или не принадлежит вашему агентству",
    });
  }

  const [guestList] = await db.select().from(schema.guestLists).where(
    eq(schema.guestLists.bookingId, booking_id),
  ).limit(1);

  if (!guestList) {
    throw createError({
      statusCode: 400,
      message: "Нельзя переназначить гида на бронирование без списка гостей",
    });
  }

  const [existingAssignment] = await db.select().from(schema.guideAssignments).where(
    and(
      eq(schema.guideAssignments.bookingId, booking_id),
      eq(schema.guideAssignments.guideId, old_guide_id),
    ),
  ).limit(1);

  if (!existingAssignment) {
    throw createError({
      statusCode: 404,
      message: "Исходное назначение гида не найдено для данного бронирования",
    });
  }

  if (existingAssignment.guideId === new_guide_id) {
    throw createError({
      statusCode: 400,
      message: "Этот гид уже назначен на данное бронирование",
    });
  }

  const [duplicate] = await db.select().from(schema.guideAssignments).where(
    and(
      eq(schema.guideAssignments.bookingId, booking_id),
      eq(schema.guideAssignments.guideId, new_guide_id),
    ),
  ).limit(1);

  if (duplicate) {
    throw createError({
      statusCode: 400,
      message: "Этот гид уже назначен на данное бронирование",
    });
  }

  await db
    .update(schema.guideAssignments)
    .set({ guideId: new_guide_id })
    .where(eq(schema.guideAssignments.id, existingAssignment.id));

  const [updatedAssignment] = await db.select().from(schema.guideAssignments).where(
    eq(schema.guideAssignments.id, existingAssignment.id),
  ).limit(1);

  const guideAssignments = await db.select().from(schema.guideAssignments).where(
    eq(schema.guideAssignments.bookingId, booking_id),
  );

  const assignedCount = guideAssignments.length;
  const required = Math.max(1, Math.ceil(booking.peopleCount / 17));

  return {
    detail: `Гид успешно переназначен на бронирование. Назначено гидов: ${assignedCount}/${required}.`,
    assignment_id: String(updatedAssignment.id),
    booking_id: String(updatedAssignment.bookingId),
    guide_id: String(updatedAssignment.guideId),
    guide_name: newGuide.name,
    guide_lastname: newGuide.lastname,
    created_at: updatedAssignment.createdAt.toISOString(),
  };
});
