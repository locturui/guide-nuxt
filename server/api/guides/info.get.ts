import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Only agencies can view guide info",
    });
  }

  const query = getQuery(event);
  const guide_id = query.guide_id as string;

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
      message: "You can only view guides from your agency",
    });
  }

  return {
    id: guide.id,
    name: guide.name,
    lastname: guide.lastname,
    agency_id: guide.agencyId,
  };
});
