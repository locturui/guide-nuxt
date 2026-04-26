import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdminOrVendor } from "~/server/utils/bonus-points";

export default defineEventHandler(async (event) => {
  await requireAdminOrVendor(event);

  const guide_id = getRouterParam(event, "id");
  if (!guide_id) {
    throw createError({ statusCode: 400, message: "guide_id обязателен" });
  }

  const db = useDB();
  const [guide] = await db.select().from(schema.guides).where(
    and(eq(schema.guides.id, guide_id), eq(schema.guides.removed, false)),
  ).limit(1);

  if (!guide) {
    throw createError({ statusCode: 404, message: "Гид не найден" });
  }

  return {
    guide_id: String(guide.id),
    guide_name: `${guide.name} ${guide.lastname}`,
    bonus_points: guide.bonusPoints ?? 0,
  };
});
