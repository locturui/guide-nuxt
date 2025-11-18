import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { date, time_str, limit } = body;

  if (!date || !time_str || limit === undefined) {
    throw createError({
      statusCode: 400,
      message: "Date, time, and limit are required",
    });
  }

  const db = useDB();

  let [day] = await db.select().from(schema.days).where(
    eq(schema.days.date, date),
  ).limit(1);

  if (!day) {
    [day] = await db
      .insert(schema.days)
      .values({
        date,
        category: "Open",
        limit: 51,
      })
      .returning();
  }

  const [existingSlot] = await db.select().from(schema.timeslots).where(
    and(
      eq(schema.timeslots.dayId, day.id),
      eq(schema.timeslots.time, time_str),
    ),
  ).limit(1);

  if (existingSlot) {
    await db
      .update(schema.timeslots)
      .set({
        limit,
      })
      .where(
        and(
          eq(schema.timeslots.dayId, day.id),
          eq(schema.timeslots.time, time_str),
        ),
      );
  }
  else {
    await db.insert(schema.timeslots).values({
      dayId: day.id,
      time: time_str,
      limit,
      limited: true,
    });
  }

  return {
    detail: "Timeslot updated",
    date,
    time: time_str,
    limit,
  };
});
