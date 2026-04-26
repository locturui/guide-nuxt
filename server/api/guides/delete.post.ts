import { and, eq, gte, inArray } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Только агентства могут удалять гидов",
    });
  }

  const body = await readBody(event);
  const { guide_id } = body;

  if (!guide_id) {
    throw createError({
      statusCode: 400,
      message: "Guide ID is required",
    });
  }

  const db = useDB();

  const [guide] = await db.select().from(schema.guides).where(eq(schema.guides.id, guide_id)).limit(1);

  if (!guide) {
    throw createError({ statusCode: 404, message: "Гид не найден" });
  }

  if (guide.agencyId !== auth.userId) {
    throw createError({ statusCode: 403, message: "Вы можете удалять только гидов из своего агентства" });
  }

  const today = new Date().toISOString().split("T")[0];

  const assignments = await db.select().from(schema.guideAssignments).where(eq(schema.guideAssignments.guideId, guide_id));
  const bookingIds = assignments.map(a => a.bookingId);

  if (bookingIds.length > 0) {
    const bookings = await db.select().from(schema.bookings).where(inArray(schema.bookings.id, bookingIds));
    const timeslotIds = bookings.map(b => b.timeslotId);
    const timeslots = timeslotIds.length > 0
      ? await db.select().from(schema.timeslots).where(inArray(schema.timeslots.id, timeslotIds))
      : [];
    const dayIds = timeslots.map(t => t.dayId);
    const futureDays = dayIds.length > 0
      ? await db.select().from(schema.days).where(and(inArray(schema.days.id, dayIds), gte(schema.days.date, today)))
      : [];
    const futureDayIds = new Set(futureDays.map(d => d.id));
    const futureTimeslotIds = new Set(timeslots.filter(t => futureDayIds.has(t.dayId)).map(t => t.id));
    const futureBookings = bookings.filter(b => futureTimeslotIds.has(b.timeslotId));

    if (futureBookings.length > 0) {
      const tsById = new Map(timeslots.map(t => [t.id, t]));
      const dayById = new Map(futureDays.map(d => [d.id, d]));
      const details = futureBookings.map((b) => {
        const ts = tsById.get(b.timeslotId);
        const day = ts ? dayById.get(ts.dayId) : null;
        return day ? `${day.date} (${b.peopleCount} человек)` : "";
      }).filter(Boolean);
      throw createError({
        statusCode: 400,
        message: `Нельзя удалить гида, назначенного на будущие экскурсии: ${details.join(", ")}`,
      });
    }
  }

  await db.update(schema.guides).set({ removed: true }).where(eq(schema.guides.id, guide_id));

  return { detail: "Guide removed successfully" };
});
