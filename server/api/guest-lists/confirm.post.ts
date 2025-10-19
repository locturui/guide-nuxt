import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";
import { validateAgeDistribution, validateGuestCount } from "~/server/utils/excel";
import { previewManager } from "~/server/utils/preview-manager";

function toDbDate(ddmmyyyy: string): string {
  const [day, month, year] = ddmmyyyy.trim().split(".");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function toFrontendDate(yyyymmdd: string): string {
  const [year, month, day] = yyyymmdd.split("-");
  return `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
}

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Only agencies can confirm guest lists",
    });
  }

  const body = await readBody(event);
  const { preview_id, booking_id, guests } = body;

  let previewData = null;
  let shouldDeleteOldPreview = false;

  if (preview_id) {
    previewData = previewManager.getPreviewSession(preview_id);

    if (previewData) {
      if (previewData.agency_id !== auth.userId.toString()) {
        throw createError({
          statusCode: 403,
          message: "Сессия предварительного просмотра не принадлежит вашему агентству",
        });
      }

      if (previewData.booking_id !== booking_id) {
        throw createError({
          statusCode: 400,
          message: "Несоответствие ID бронирования",
        });
      }

      shouldDeleteOldPreview = true;
    }
  }

  const db = useDB();

  const [booking] = await db.select().from(schema.bookings).where(
    and(
      eq(schema.bookings.id, Number(booking_id)),
      eq(schema.bookings.agencyId, auth.userId),
    ),
  ).limit(1);

  if (!booking) {
    throw createError({
      statusCode: 404,
      message: "Бронирование не найдено или не принадлежит вашему агентству",
    });
  }

  const [existingList] = await db.select().from(schema.guestLists).where(
    eq(schema.guestLists.bookingId, Number(booking_id)),
  ).limit(1);

  if (existingList) {
    throw createError({
      statusCode: 400,
      message: "Список гостей уже существует для данного бронирования",
    });
  }

  const guestData = guests.map((g: any) => ({
    name: g.name,
    date_of_birth: g.date_of_birth,
    city: g.city,
    phone: g.phone,
    errors: [] as string[],
  }));

  let hasErrors = false;
  for (const guest of guestData) {
    if (!guest.name?.trim())
      guest.errors.push("Имя обязательно");
    if (!guest.date_of_birth?.trim())
      guest.errors.push("Дата рождения обязательна");
    if (!guest.city?.trim())
      guest.errors.push("Город обязателен");
    if (!guest.phone?.trim())
      guest.errors.push("Номер телефона обязателен");

    if (guest.errors.length > 0)
      hasErrors = true;
  }

  const countErrors = validateGuestCount(guestData.length, booking.peopleCount);
  if (countErrors.length > 0) {
    setResponseStatus(event, 400);
    return {
      booking_id,
      guests: guestData,
      errors: countErrors,
    };
  }

  const ageErrors = validateAgeDistribution(guestData);
  if (ageErrors.length > 0) {
    setResponseStatus(event, 400);
    return {
      booking_id,
      guests: guestData,
      errors: ageErrors,
    };
  }

  if (hasErrors) {
    if (shouldDeleteOldPreview && preview_id) {
      previewManager.deletePreviewSession(preview_id);
    }

    const newPreviewData = {
      booking_id,
      agency_id: auth.userId.toString(),
      guest_previews: guestData,
      general_errors: [],
    };

    const new_preview_id = previewManager.createPreviewSession(newPreviewData);

    setResponseStatus(event, 400);
    return {
      booking_id,
      preview_id: new_preview_id,
      guests: guestData,
    };
  }

  const [guestList] = await db
    .insert(schema.guestLists)
    .values({
      bookingId: Number(booking_id),
      source: "excel",
    })
    .returning();

  const createdGuests = [];
  for (const guest of guestData) {
    const [created] = await db
      .insert(schema.guests)
      .values({
        guestListId: guestList.id,
        name: guest.name.trim(),
        dateOfBirth: toDbDate(guest.date_of_birth),
        city: guest.city.trim(),
        phone: guest.phone.trim(),
      })
      .returning();
    createdGuests.push(created);
  }

  await db
    .update(schema.bookings)
    .set({ status: "filled" })
    .where(eq(schema.bookings.id, Number(booking_id)));

  if (shouldDeleteOldPreview && preview_id) {
    previewManager.deletePreviewSession(preview_id);
  }

  return {
    booking_id,
    preview_id: "",
    guests: [],
    errors: [],
    guest_list: {
      id: guestList.id,
      booking_id,
      source: guestList.source,
      created_at: guestList.createdAt.toISOString(),
      updated_at: guestList.updatedAt.toISOString(),
      guests: createdGuests.map(g => ({
        id: g.id,
        name: g.name,
        date_of_birth: toFrontendDate(g.dateOfBirth),
        city: g.city,
        phone: g.phone,
        created_at: g.createdAt.toISOString(),
        updated_at: g.updatedAt.toISOString(),
      })),
    },
  };
});
