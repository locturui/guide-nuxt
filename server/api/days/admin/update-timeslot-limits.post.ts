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

  for (const [date, time] of timeslots) {
    const [existingSlot] = await db.select().from(schema.timeslots).where(
      and(
        eq(schema.timeslots.date, date),
        eq(schema.timeslots.time, time),
      ),
    ).limit(1);

    if (existingSlot) {
      await db
        .update(schema.timeslots)
        .set({
          limit,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.timeslots.date, date),
            eq(schema.timeslots.time, time),
          ),
        );
    }
    else {
      await db.insert(schema.timeslots).values({
        date,
        time,
        limit,
      });
    }

    updatedCount++;
  }

  return {
    detail: `Successfully updated ${updatedCount} timeslot(s) with new limit: ${limit}`,
    updated_count: updatedCount,
    timeslots,
  };
});
