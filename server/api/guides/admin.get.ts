import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const db = useDB();

  const guides = await db.select().from(schema.guides);

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
      badge_number: guide.badgeNumber,
    });
  });

  return guidesByAgency;
});
