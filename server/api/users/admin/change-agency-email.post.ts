import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { agency_id, new_email } = body;

  if (!agency_id || !new_email) {
    throw createError({
      statusCode: 400,
      message: "Agency ID and new email are required",
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

  const [existingUser] = await db.select().from(schema.users).where(eq(schema.users.email, new_email),
  ).limit(1);

  if (existingUser && existingUser.id !== agency_id) {
    throw createError({
      statusCode: 400,
      message: "Email already in use",
    });
  }

  await db
    .update(schema.users)
    .set({
      email: new_email,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, agency_id));

  return {
    agency_id,
    old_email: agency.email,
    new_email,
  };
});
