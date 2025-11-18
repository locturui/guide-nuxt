import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const db = useDB();

  const agencies = await db.select().from(schema.users).where(
    eq(schema.users.role, "agency"),
  );

  return {
    agencies: agencies.map((a: any) => ({
      agency_id: a.id,
      email: a.email,
      name: a.agencyName || a.email,
    })),
  };
});
