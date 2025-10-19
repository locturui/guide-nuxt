import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Only agencies can create guides",
    });
  }

  const body = await readBody(event);
  const { name, lastname, badge_number } = body;

  if (!name || !lastname) {
    throw createError({
      statusCode: 400,
      message: "Name and lastname are required",
    });
  }

  const db = useDB();

  const [guide] = await db
    .insert(schema.guides)
    .values({
      agencyId: auth.userId,
      name,
      lastname,
      badgeNumber: badge_number || null,
    })
    .returning();

  return {
    id: guide.id,
    name: guide.name,
    lastname: guide.lastname,
    agency_id: guide.agencyId,
    badge_number: guide.badgeNumber,
  };
});
