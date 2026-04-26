import { count, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const guestId = getRouterParam(event, "id");
  if (!guestId) {
    setResponseStatus(event, 400);
    return { errors: ["Неверный формат ID гостя"] };
  }

  const db = useDB();

  const [guest] = await db.select().from(schema.guests).where(eq(schema.guests.id, guestId)).limit(1);
  if (!guest) {
    setResponseStatus(event, 404);
    return { errors: ["Гость не найден"] };
  }

  const [guestList] = await db.select().from(schema.guestLists).where(eq(schema.guestLists.id, guest.guestListId)).limit(1);
  if (!guestList) {
    setResponseStatus(event, 404);
    return { errors: ["Список гостей не найден"] };
  }

  const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, guestList.bookingId)).limit(1);
  if (!booking) {
    setResponseStatus(event, 404);
    return { errors: ["Бронирование не найдено"] };
  }

  const guestInfo = { id: String(guest.id), name: guest.name, was_deleted: true };

  await db.delete(schema.guests).where(eq(schema.guests.id, guestId));

  const remaining = await db.select({ c: count() }).from(schema.guests).where(eq(schema.guests.guestListId, guestList.id));
  const newCount = Number(remaining[0]?.c ?? 0);

  await db.update(schema.bookings).set({ peopleCount: newCount }).where(eq(schema.bookings.id, booking.id));

  if (newCount === 0) {
    await db.delete(schema.guideAssignments).where(eq(schema.guideAssignments.bookingId, booking.id));
    await db.delete(schema.guestLists).where(eq(schema.guestLists.id, guestList.id));
  }

  return {
    success: true,
    message: "Гость успешно удален",
    deleted_guest: guestInfo,
    updated_booking_people_count: newCount,
  };
});
