import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Only agencies can view guides",
    });
  }

  const db = useDB();

  const guides = await db.select().from(schema.guides).where(eq(schema.guides.agencyId, auth.userId),
  );

  return {
    guides: guides.map(g => ({
      id: g.id,
      name: g.name,
      lastname: g.lastname,
      agency_id: g.agencyId,
      badge_number: g.badgeNumber,
    })),
  };
});
