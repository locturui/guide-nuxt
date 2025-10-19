import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Only agencies can reassign guides",
    });
  }

  const body = await readBody(event);
  const { booking_id, new_guide_id } = body;

  if (!booking_id || !new_guide_id) {
    throw createError({
      statusCode: 400,
      message: "Booking ID and new guide ID are required",
    });
  }

  const db = useDB();

  const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, Number(booking_id)),
  ).limit(1);

  if (!booking || booking.agencyId !== auth.userId) {
    throw createError({
      statusCode: 404,
      message: "Booking not found or doesn't belong to your agency",
    });
  }

  const [guide] = await db.select().from(schema.guides).where(eq(schema.guides.id, new_guide_id),
  ).limit(1);

  if (!guide || guide.agencyId !== auth.userId) {
    throw createError({
      statusCode: 404,
      message: "Guide not found or doesn't belong to your agency",
    });
  }

  const [guestList] = await db.select().from(schema.guestLists).where(eq(schema.guestLists.bookingId, Number(booking_id)),
  ).limit(1);

  if (!guestList) {
    throw createError({
      statusCode: 400,
      message: "Cannot reassign guide to booking without guest list",
    });
  }

  const [existing] = await db.select().from(schema.guideAssignments).where(eq(schema.guideAssignments.bookingId, Number(booking_id)),
  ).limit(1);

  if (existing) {
    if (existing.guideId === new_guide_id) {
      throw createError({
        statusCode: 400,
        message: "This guide is already assigned to this booking",
      });
    }

    await db
      .update(schema.guideAssignments)
      .set({ guideId: new_guide_id })
      .where(eq(schema.guideAssignments.id, existing.id));

    return {
      detail: "Гид успешно переназначен на бронирование",
      assignment_id: existing.id,
      booking_id,
      guide_id: new_guide_id,
      guide_name: guide.name,
      guide_lastname: guide.lastname,
      created_at: existing.createdAt.toISOString(),
    };
  }
  else {
    const [assignment] = await db
      .insert(schema.guideAssignments)
      .values({
        bookingId: Number(booking_id),
        guideId: new_guide_id,
      })
      .returning();

    await db
      .update(schema.bookings)
      .set({ status: "assigned" })
      .where(eq(schema.bookings.id, Number(booking_id)));

    return {
      detail: "Гид успешно переназначен на бронирование",
      assignment_id: assignment.id,
      booking_id,
      guide_id: new_guide_id,
      guide_name: guide.name,
      guide_lastname: guide.lastname,
      created_at: assignment.createdAt.toISOString(),
    };
  }
});
