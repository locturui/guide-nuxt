import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Only agencies can access this endpoint",
    });
  }

  const db = useDB();

  const [user] = await db.select().from(schema.users).where(
    eq(schema.users.id, auth.userId),
  ).limit(1);

  if (!user) {
    throw createError({
      statusCode: 404,
      message: "User not found",
    });
  }

  return {
    id: user.id,
    email: user.email,
    agency_name: user.name || user.email,
  };
});
