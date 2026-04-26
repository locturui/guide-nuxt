import type { H3Event } from "h3";

import { requireAuth } from "~/server/utils/auth";

export async function requireAdminOrVendor(event: H3Event) {
  const auth = await requireAuth(event);
  if (auth.role !== "admin" && auth.role !== "vendor") {
    throw createError({ statusCode: 403, message: "Admin or vendor access required" });
  }
  return auth;
}
