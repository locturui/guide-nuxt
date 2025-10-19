import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { generateAccessToken, generateRefreshToken, verifyPassword } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const body = await readFormData(event);
  const username = body.get("username") as string;
  const password = body.get("password") as string;

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      message: "Username and password are required",
    });
  }

  const db = useDB();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, username),
  ).limit(1);

  if (!user) {
    throw createError({
      statusCode: 401,
      message: "Invalid credentials",
    });
  }

  const isValidPassword = await verifyPassword(password, user.password);
  if (!isValidPassword) {
    throw createError({
      statusCode: 401,
      message: "Invalid credentials",
    });
  }

  const accessToken = generateAccessToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id, user.role);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    role: user.role,
  };
});
