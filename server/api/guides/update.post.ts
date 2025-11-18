import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Only agencies can update guides",
    });
  }

  const body = await readBody(event);
  const { guide_id, name, lastname } = body;

  if (!guide_id || !lastname) {
    throw createError({
      statusCode: 400,
      message: "Guide ID and lastname are required",
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
      message: "You can only update your own guides",
    });
  }

  const updateData: any = {
    lastname,
  };

  if (name !== undefined && name !== null) {
    updateData.name = name;
  }

  await db
    .update(schema.guides)
    .set(updateData)
    .where(eq(schema.guides.id, guide_id));

  const [updatedGuide] = await db.select().from(schema.guides).where(eq(schema.guides.id, guide_id),
  ).limit(1);

  return {
    id: updatedGuide.id,
    name: updatedGuide.name,
    lastname: updatedGuide.lastname,
    agency_id: updatedGuide.agencyId,
  };
});
