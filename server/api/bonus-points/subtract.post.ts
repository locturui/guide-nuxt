import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdminOrVendor } from "~/server/utils/bonus-points";

export default defineEventHandler(async (event) => {
  await requireAdminOrVendor(event);

  const body = await readBody(event);
  const { guide_id, points } = body as { guide_id?: string; points?: number };

  if (!guide_id || typeof points !== "number" || points <= 0) {
    throw createError({ statusCode: 400, message: "guide_id и положительное число points обязательны" });
  }

  const db = useDB();
  const [guide] = await db.select().from(schema.guides).where(
    and(eq(schema.guides.id, guide_id), eq(schema.guides.removed, false)),
  ).limit(1);

  if (!guide) {
    throw createError({ statusCode: 404, message: "Гид не найден" });
  }

  const previous = guide.bonusPoints ?? 0;
  if (previous < points) {
    throw createError({
      statusCode: 400,
      message: `Недостаточно баллов. У гида ${previous} баллов, попытка списать ${points}`,
    });
  }
  const newPoints = previous - points;
  await db.update(schema.guides).set({ bonusPoints: newPoints }).where(eq(schema.guides.id, guide_id));

  return {
    guide_id: String(guide.id),
    previous_points: previous,
    new_points: newPoints,
    operation: "subtract",
    detail: `Вычтено ${points} баллов`,
  };
});
