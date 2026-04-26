import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  if (auth.role !== "admin") {
    throw createError({ statusCode: 403, message: "Admin access required" });
  }

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

  const newPoints = (guide.bonusPoints ?? 0) + points;
  await db.update(schema.guides).set({ bonusPoints: newPoints }).where(eq(schema.guides.id, guide_id));

  return {
    guide_id: String(guide.id),
    current_points: newPoints,
  };
});
