import { eq, sql } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { date, category, limit: inputLimit } = body;

  if (!date || !category) {
    throw createError({
      statusCode: 400,
      message: "Date and category are required",
    });
  }

  const db = useDB();

  let dayLimit: number;
  if (category === "closed" || category === "Closed") {
    dayLimit = 0;
  }
  else if (category === "limited" || category === "Limited") {
    if (inputLimit === undefined || inputLimit === null) {
      throw createError({
        statusCode: 400,
        message: "Limit is required for Limited category",
      });
    }
    dayLimit = inputLimit;
  }
  else {
    dayLimit = inputLimit ?? 51;
  }

  const [existingDay] = await db.select().from(schema.days).where(
    eq(schema.days.date, date),
  ).limit(1);

  if (existingDay) {
    await db
      .update(schema.days)
      .set({
        category,
        limit: dayLimit,
      })
      .where(eq(schema.days.date, date));
  }
  else {
    await db.insert(schema.days).values({
      date,
      category,
      limit: dayLimit,
    });
  }

  const [day] = await db.select().from(schema.days).where(
    eq(schema.days.date, date),
  ).limit(1);

  if (day) {
    await db.execute(sql`
      UPDATE timeslots
      SET "limit" = ${dayLimit}
      WHERE day_id = ${day.id}
    `);
  }

  return {
    detail: "Day updated",
    date,
    category,
    limit: dayLimit,
  };
});
