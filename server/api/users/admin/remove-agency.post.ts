import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { agency_id } = body;

  if (!agency_id) {
    throw createError({
      statusCode: 400,
      message: "Agency ID is required",
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

  await db.delete(schema.users).where(eq(schema.users.id, agency_id));

  return {
    ok: true,
    agency_id,
  };
});
