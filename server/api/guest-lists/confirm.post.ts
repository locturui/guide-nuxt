import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";
import { normalizePhoneNumber, parseDateOfBirthToAge, validateAgesComplete, validateDateFormat, validateGuestAge } from "~/server/utils/guest-validation";
import { previewManager } from "~/server/utils/preview-manager";

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
      eq(schema.bookings.id, booking_id),
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
    eq(schema.guestLists.bookingId, booking_id),
  ).limit(1);

  if (existingList) {
    throw createError({
      statusCode: 400,
      message: "Список гостей уже существует для данного бронирования",
    });
  }

  const guestData = [];
  const ages: number[] = [];
  let personaErrors = 0;

  for (const g of guests) {
    const errors: string[] = [];
    const name = String(g.name || "").trim();
    const dateOfBirth = String(g.date_of_birth || "").trim();
    const city = String(g.city || "").trim();
    const phone = String(g.phone || "").trim();

    if (!name)
      errors.push("Имя обязательно");
    if (!dateOfBirth)
      errors.push("Дата рождения обязательна");
    if (!city)
      errors.push("Город обязателен");
    if (!phone)
      errors.push("Номер телефона обязателен");

    let age = 0;
    if (dateOfBirth && !validateDateFormat(dateOfBirth)) {
      errors.push(`Неверный формат даты '${dateOfBirth}'. Ожидается DD.MM.YYYY`);
    }
    else if (dateOfBirth) {
      try {
        age = parseDateOfBirthToAge(dateOfBirth);
        ages.push(age);
        if (!validateGuestAge(age)) {
          errors.push(`Гость должен быть не младше 12 лет. Текущий возраст: ${age}`);
        }
      }
      catch (error: any) {
        errors.push(String(error));
      }
    }

    let normalizedPhone = phone;
    if (phone) {
      try {
        normalizedPhone = normalizePhoneNumber(phone);
      }
      catch (error: any) {
        errors.push(String(error));
      }
    }

    guestData.push({
      name,
      date_of_birth: dateOfBirth,
      city,
      phone: normalizedPhone,
      errors,
    });

    if (errors.length > 0) {
      personaErrors += errors.length;
    }
  }

  const generalErrors: string[] = [];

  if (guestData.length !== booking.peopleCount) {
    generalErrors.push(
      `Количество гостей в Excel (${guestData.length}) должно соответствовать количеству людей в бронировании (${booking.peopleCount})`,
    );
  }

  const [validationResult, adults, minors] = validateAgesComplete(ages);
  if (!validationResult) {
    if (adults !== -1 && minors !== -1) {
      generalErrors.push(
        `Количество взрослых должно быть не менее количества детей (${adults} < ${minors})`,
      );
    }
  }

  if (generalErrors.length > 0) {
    setResponseStatus(event, 400);
    return {
      errors: generalErrors,
      details: {
        booking_id,
      },
    };
  }

  if (personaErrors > 0) {
    const updatedPreviewData = {
      booking_id,
      guests: guestData,
      agency_id: auth.userId.toString(),
      general_errors: [],
    };

    if (shouldDeleteOldPreview && preview_id) {
      previewManager.deletePreviewSession(preview_id);
    }

    const new_preview_id = previewManager.createPreviewSession(updatedPreviewData);

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
      bookingId: booking_id,
      source: "excel_import",
    })
    .returning();

  const guestsToInsert = guestData.map(guest => ({
    guestListId: guestList.id,
    name: guest.name.trim(),
    dateOfBirth: guest.date_of_birth.trim(),
    age: parseDateOfBirthToAge(guest.date_of_birth),
    city: guest.city.trim(),
    phone: normalizePhoneNumber(guest.phone),
  }));

  const createdGuests = guestsToInsert.length > 0
    ? await db.insert(schema.guests).values(guestsToInsert).returning()
    : [];

  if (shouldDeleteOldPreview && preview_id) {
    previewManager.deletePreviewSession(preview_id);
  }

  const guideAssignments = await db.select().from(schema.guideAssignments).where(
    eq(schema.guideAssignments.bookingId, booking_id),
  );

  const guideIds = guideAssignments.map(ga => String(ga.guideId));

  return {
    booking_id,
    preview_id: "",
    guests: [],
    errors: [],
    guest_list: {
      id: guestList.id,
      booking_id: String(guestList.bookingId),
      source: guestList.source,
      created_at: guestList.createdAt.toISOString(),
      updated_at: guestList.updatedAt.toISOString(),
      guests: createdGuests.map(g => ({
        id: g.id,
        name: g.name,
        date_of_birth: g.dateOfBirth,
        age: g.age,
        city: g.city,
        phone: g.phone,
        created_at: g.createdAt.toISOString(),
        updated_at: g.updatedAt.toISOString(),
      })),
      guide_ids: guideIds,
    },
  };
});
