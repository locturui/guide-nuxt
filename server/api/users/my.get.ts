import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  const db = useDB();

  const [user] = await db.select({
    id: schema.users.id,
    email: schema.users.email,
    role: schema.users.role,
    agencyName: schema.users.agencyName,
  }).from(schema.users).where(
    eq(schema.users.id, auth.userId),
  ).limit(1);

  if (!user) {
    throw createError({
      statusCode: 404,
      message: "User not found",
    });
  }

  if (auth.role === "agency") {
    return {
      id: user.id,
      email: user.email,
      agency_name: user.agencyName || user.email,
    };
  }
  else if (auth.role === "admin") {
    return {
      id: user.id,
      email: user.email,
    };
  }
  else {
    throw createError({
      statusCode: 403,
      message: "Invalid user role",
    });
  }
});
