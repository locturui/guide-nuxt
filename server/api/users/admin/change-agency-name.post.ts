import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { agency_id, new_name } = body;

  if (!agency_id || !new_name) {
    throw createError({
      statusCode: 400,
      message: "Agency ID and new name are required",
    });
  }

  const db = useDB();

  const [agency] = await db.select().from(schema.users).where(eq(schema.users.id, agency_id),
  ).limit(1);

  if (!agency || agency.role !== "agency") {
    throw createError({
      statusCode: 404,
      message: "Agency not found",
    });
  }

  const oldName = agency.name;

  await db
    .update(schema.users)
    .set({
      name: new_name,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, agency_id));

  return {
    agency_id,
    old_name: oldName,
    new_name,
  };
});
