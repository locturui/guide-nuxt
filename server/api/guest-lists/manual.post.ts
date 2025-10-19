import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";
import { previewManager } from "~/server/utils/preview-manager";

function calculateAge(dateOfBirth: string): number {
  const [day, month, year] = dateOfBirth.split(".").map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

function validateDateFormat(date: string): boolean {
  const regex = /^\d{2}\.\d{2}\.\d{4}$/;
  return regex.test(date);
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.length !== 11 || !digits.startsWith("7")) {
    throw new Error(`Неверный формат телефона: ${phone}. Ожидается 11 цифр, начиная с 7`);
  }

  return digits;
}

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
    eq(schema.bookings.id, Number(booking_id)),
  ).limit(1);

  if (!booking || booking.agencyId !== auth.userId) {
    throw createError({
      statusCode: 404,
      message: "Бронирование не найдено или не принадлежит вашему агентству",
    });
  }

  const [existing] = await db.select().from(schema.guestLists).where(
    eq(schema.guestLists.bookingId, Number(booking_id)),
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
        age = calculateAge(dateOfBirth);
        ages.push(age);
        if (age < 12) {
          errors.push(`Гость должен быть не младше 12 лет. Текущий возраст: ${age}`);
        }
      }
      catch {
        errors.push("Ошибка при расчете возраста");
      }
    }

    let normalizedPhone = phone;
    if (phone) {
      try {
        normalizedPhone = normalizePhone(phone);
      }
      catch (error: any) {
        errors.push(error.message);
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

  if (ages.length > 0) {
    const adults = ages.filter(a => a >= 18).length;
    const minors = ages.filter(a => a < 18).length;

    if (adults < minors) {
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
