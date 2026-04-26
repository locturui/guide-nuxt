import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";
import {
  buildPreview,
  createBookingAndGuestList,
  parseDailyJsonData,
  processGroupForPreview,
  updateExistingBookingWithGuestList,
  validateDailyGroupAgeRules,
} from "~/server/utils/daily-lists";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const body = await readBody(event);

  const { groups, errors: parseErrors } = parseDailyJsonData(body);
  parseErrors.push(...validateDailyGroupAgeRules(groups));

  const sheetPreviews = await Promise.all(groups.map(g => processGroupForPreview(g, auth.userId)));
  const hasSheetErrors = sheetPreviews.some(s => s.sheet_errors.length > 0);

  if (parseErrors.length > 0 || hasSheetErrors) {
    return buildPreview(groups, parseErrors, sheetPreviews);
  }

  const db = useDB();
  const created: string[] = [];
  const updated: string[] = [];
  const creationErrors: string[] = [];

  for (const group of groups) {
    try {
      const ddmm = group.date.split(".");
      const iso = `${ddmm[2]}-${ddmm[1]}-${ddmm[0]}`;
      const [day] = await db.select().from(schema.days).where(eq(schema.days.date, iso)).limit(1);

      let existingBookingId: string | null = null;
      if (day) {
        const [ts] = await db.select().from(schema.timeslots).where(
          and(eq(schema.timeslots.dayId, day.id), eq(schema.timeslots.time, group.timeslot_time)),
        ).limit(1);
        if (ts) {
          const [b] = await db.select().from(schema.bookings).where(
            and(eq(schema.bookings.timeslotId, ts.id), eq(schema.bookings.agencyId, auth.userId)),
          ).limit(1);
          if (b)
            existingBookingId = String(b.id);
        }
      }

      if (existingBookingId) {
        const r = await updateExistingBookingWithGuestList(existingBookingId, group);
        if (r.errors.length > 0)
          creationErrors.push(...r.errors);
        else if (r.booking)
          updated.push(String(r.booking.id));
      }
      else {
        const r = await createBookingAndGuestList(group, auth.userId);
        if (r.errors.length > 0)
          creationErrors.push(...r.errors);
        else if (r.booking)
          created.push(String(r.booking.id));
      }
    }
    catch (e: any) {
      creationErrors.push(`Ошибка при обработке группы ${group.sheet_name}: ${e?.message ?? String(e)}`);
    }
  }

  if (creationErrors.length > 0) {
    setResponseStatus(event, 400);
    return { errors: creationErrors };
  }

  return {
    success: true,
    message: "Ежедневный список успешно обработан",
    created_bookings: created,
    updated_bookings: updated,
    total_processed: created.length + updated.length,
  };
});
