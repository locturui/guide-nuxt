import { and, eq, inArray } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  if (auth.role !== "admin" && auth.role !== "vendor") {
    throw createError({ statusCode: 403, message: "Только администратор или вендор может просматривать всех гидов" });
  }

  const db = useDB();

  const agencyUsers = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "agency"));
  const agencyIds = agencyUsers.map(u => u.id);
  if (agencyIds.length === 0)
    return {};

  const guides = await db.select().from(schema.guides).where(
    and(inArray(schema.guides.agencyId, agencyIds), eq(schema.guides.removed, false)),
  );

  const guidesByAgency: Record<string, any[]> = {};

  guides.forEach((guide) => {
    const agencyId = guide.agencyId;
    if (!guidesByAgency[agencyId]) {
      guidesByAgency[agencyId] = [];
    }
    guidesByAgency[agencyId].push({
      id: guide.id,
      name: guide.name,
      lastname: guide.lastname,
      agency_id: guide.agencyId,
      bonus_points: guide.bonusPoints ?? 0,
      removed: guide.removed ?? false,
    });
  });

  return guidesByAgency;
});
