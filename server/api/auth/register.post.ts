import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { hashPassword } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { email, password, name } = body;

  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: "Email and password are required",
    });
  }

  const db = useDB();

  const [existingUser] = await db.select().from(schema.users).where(eq(schema.users.email, email),
  ).limit(1);

  if (existingUser) {
    throw createError({
      statusCode: 400,
      message: "User already exists",
    });
  }

  const hashedPassword = await hashPassword(password);
  await db.insert(schema.users).values({
    email,
    password: hashedPassword,
    role: "agency", // New registrations are agencies by default
    name: name || email,
  });

  return {
    message: "User created successfully",
  };
});
