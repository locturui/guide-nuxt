import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  if (auth.role !== "admin" && auth.role !== "vendor") {
    throw createError({
      statusCode: 403,
      message: "Только администратор или вендор может просматривать гидов",
    });
  }

  const query = getQuery(event);
  const guide_id = query.guide_id as string;
  if (!guide_id) {
    throw createError({ statusCode: 400, message: "Guide ID is required" });
  }

  const db = useDB();
  const [guide] = await db.select().from(schema.guides).where(eq(schema.guides.id, guide_id)).limit(1);

  if (!guide) {
    throw createError({ statusCode: 404, message: "Гид не найден" });
  }

  return {
    id: guide.id,
    name: guide.name,
    lastname: guide.lastname,
    agency_id: guide.agencyId,
    bonus_points: guide.bonusPoints ?? 0,
    removed: guide.removed ?? false,
  };
});
