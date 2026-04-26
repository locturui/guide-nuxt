import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const body = await readBody(event);
  const { booking_id } = body as { booking_id?: string };
  if (!booking_id) {
    throw createError({ statusCode: 400, message: "booking_id обязателен" });
  }

  const db = useDB();

  const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, booking_id)).limit(1);
  if (!booking) {
    throw createError({ statusCode: 404, message: "Бронирование не найдено" });
  }
  if (auth.role === "agency" && booking.agencyId !== auth.userId) {
    throw createError({ statusCode: 403, message: "Вы можете просматривать только свои бронирования" });
  }

  const [timeslot] = await db.select().from(schema.timeslots).where(eq(schema.timeslots.id, booking.timeslotId)).limit(1);
  if (!timeslot) {
    throw createError({ statusCode: 404, message: "Таймслот не найден" });
  }
  const [day] = await db.select().from(schema.days).where(eq(schema.days.id, timeslot.dayId)).limit(1);
  if (!day) {
    throw createError({ statusCode: 404, message: "День не найден" });
  }

  return { date: day.date, time: timeslot.time };
});
