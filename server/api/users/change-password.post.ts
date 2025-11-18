import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { hashPassword, requireAuth, verifyPassword } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  const body = await readBody(event);
  const { old_password, new_password } = body;

  if (!old_password || !new_password) {
    throw createError({
      statusCode: 400,
      message: "Old password and new password are required",
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

  const isValidPassword = await verifyPassword(old_password, user.password);
  if (!isValidPassword) {
    throw createError({
      statusCode: 400,
      message: "Старый пароль неверен",
    });
  }

  const hashedPassword = await hashPassword(new_password);

  await db
    .update(schema.refreshTokens)
    .set({ revoked: true })
    .where(eq(schema.refreshTokens.userId, auth.userId));

  await db
    .update(schema.users)
    .set({ password: hashedPassword })
    .where(eq(schema.users.id, auth.userId));

  return {
    detail: "Password changed and all sessions invalidated",
  };
});
