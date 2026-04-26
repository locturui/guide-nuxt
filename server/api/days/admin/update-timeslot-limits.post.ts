import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { limit, timeslots } = body;

  if (limit === undefined || !timeslots || !Array.isArray(timeslots)) {
    throw createError({
      statusCode: 400,
      message: "Limit and timeslots array are required",
    });
  }

  const db = useDB();
  let updatedCount = 0;
  const updatedTimeslots: Array<[string, string]> = [];

  for (const [date, time] of timeslots) {
    let [day] = await db.select().from(schema.days).where(eq(schema.days.date, date)).limit(1);
    if (!day) {
      [day] = await db.insert(schema.days).values({ date, category: "Open", limit: 51 }).returning();
    }

    let [existingSlot] = await db.select().from(schema.timeslots).where(
      and(eq(schema.timeslots.dayId, day.id), eq(schema.timeslots.time, time)),
    ).limit(1);

    if (existingSlot) {
      await db
        .update(schema.timeslots)
        .set({ limit, limited: true })
        .where(eq(schema.timeslots.id, existingSlot.id));
    }
    else {
      const defaultLimit = limit;
      [existingSlot] = await db.insert(schema.timeslots).values({
        dayId: day.id,
        time,
        limit: defaultLimit,
        limited: true,
      }).returning();
    }

    updatedCount++;
    updatedTimeslots.push([date, time]);
  }

  return {
    detail: `Successfully updated ${updatedCount} timeslot(s) with new limit: ${limit}`,
    updated_count: updatedCount,
    timeslots: updatedTimeslots,
  };
});
