import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";
import { normalizePhoneNumber, parseDateOfBirthToAge, validateAgesComplete, validateDateFormat, validateGuestAge } from "~/server/utils/guest-validation";
import { previewManager } from "~/server/utils/preview-manager";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Только агентства могут создавать списки гостей",
    });
  }

  const body = await readBody(event);
  const { booking_id, guests } = body;

  if (!booking_id || !guests || !Array.isArray(guests)) {
    throw createError({
      statusCode: 400,
      message: "Требуется ID бронирования и массив гостей",
    });
  }

  const db = useDB();

  const [booking] = await db.select().from(schema.bookings).where(
    eq(schema.bookings.id, booking_id),
  ).limit(1);

  if (!booking || booking.agencyId !== auth.userId) {
    throw createError({
      statusCode: 404,
      message: "Бронирование не найдено или не принадлежит вашему агентству",
    });
  }

  const [existing] = await db.select().from(schema.guestLists).where(
    eq(schema.guestLists.bookingId, booking_id),
  ).limit(1);

  if (existing) {
    throw createError({
      statusCode: 400,
      message: "Список гостей уже существует для данного бронирования",
    });
  }

  const guestPreviews = [];
  const ages: number[] = [];
  let personaErrors = 0;

  for (const guestData of guests) {
    const errors: string[] = [];

    const name = guestData.name?.trim() || "";
    const dateOfBirth = guestData.date_of_birth?.trim() || "";
    const city = guestData.city?.trim() || "";
    const phone = guestData.phone?.trim() || "";

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

    guestPreviews.push({
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

  if (guestPreviews.length !== booking.peopleCount) {
    generalErrors.push(
      `Количество гостей (${guestPreviews.length}) должно соответствовать количеству людей в бронировании (${booking.peopleCount})`,
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

  const previewData = {
    booking_id,
    agency_id: auth.userId.toString(),
    guest_previews: guestPreviews,
    general_errors: generalErrors,
  };

  const preview_id = previewManager.createPreviewSession(previewData);

  const hasErrors = generalErrors.length > 0 || personaErrors > 0;

  if (hasErrors) {
    setResponseStatus(event, 400);
    return {
      booking_id,
      preview_id,
      guests: guestPreviews,
      errors: generalErrors,
    };
  }

  return {
    booking_id,
    preview_id,
    guests: guestPreviews,
    errors: [],
  };
});
