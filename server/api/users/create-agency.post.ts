import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { hashPassword, requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { email, agency_name } = body;

  if (!email || !agency_name) {
    throw createError({
      statusCode: 400,
      message: "Email and agency_name are required",
    });
  }

  if (agency_name.length < 1 || agency_name.length > 100) {
    throw createError({
      statusCode: 400,
      message: "Agency name must be between 1 and 100 characters",
    });
  }

  const db = useDB();

  const [existingUser] = await db.select().from(schema.users).where(
    eq(schema.users.email, email),
  ).limit(1);

  if (existingUser) {
    throw createError({
      statusCode: 400,
      message: "Email уже зарегистрирован",
    });
  }

  const randomPassword = crypto.randomUUID().substring(0, 10);
  const hashedPassword = await hashPassword(randomPassword);

  const [newUser] = await db
    .insert(schema.users)
    .values({
      email,
      password: hashedPassword,
      role: "agency",
      agencyName: agency_name,
    })
    .returning();

  return {
    email: newUser.email,
    agency_name: newUser.agencyName,
  };
});
