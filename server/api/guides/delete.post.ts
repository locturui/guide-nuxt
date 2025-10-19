import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Only agencies can delete guides",
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

  const [guide] = await db.select().from(schema.guides).where(eq(schema.guides.id, guide_id),
  ).limit(1);

  if (!guide) {
    throw createError({
      statusCode: 404,
      message: "Guide not found",
    });
  }

  if (guide.agencyId !== auth.userId) {
    throw createError({
      statusCode: 403,
      message: "You can only delete your own guides",
    });
  }

  await db.delete(schema.guides).where(eq(schema.guides.id, guide_id));

  return {
    ok: true,
  };
});
