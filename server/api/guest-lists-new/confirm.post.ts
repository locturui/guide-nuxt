import { and, eq } from "drizzle-orm";

import type { GuestGeneralError, GuestRowError } from "~/server/utils/guest-list-errors";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";
import { validateAgeDistribution, validateGuestCount } from "~/server/utils/excel";
import { makeRowError } from "~/server/utils/guest-list-errors";
import {
  normalizePhoneNumber,
  parseDateOfBirthToAge,
  validateDateFormat,
  validateGuestAge,
} from "~/server/utils/guest-validation";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  if (auth.role !== "agency") {
    setResponseStatus(event, 403);
    return { errors: ["Только агентства могут подтверждать списки гостей"] };
  }

  const formData = await readFormData(event);
  const booking_id = formData.get("booking_id") as string;
  const guestsRaw = formData.get("guests") as string;

  if (!booking_id || !guestsRaw) {
    setResponseStatus(event, 400);
    return { errors: ["booking_id и guests обязательны"] };
  }

  let guestsInput: any[];
  try {
    guestsInput = JSON.parse(guestsRaw);
  }
  catch {
    setResponseStatus(event, 400);
    return { errors: ["Неверный JSON в поле guests"] };
  }

  const db = useDB();

  const [booking] = await db.select().from(schema.bookings).where(
    and(eq(schema.bookings.id, booking_id), eq(schema.bookings.agencyId, auth.userId)),
  ).limit(1);

  const allErrors: Array<GuestRowError | GuestGeneralError> = [];

  // Validate each guest, accumulating per-row errors.
  const guests = guestsInput.map((g, idx) => {
    const errors: string[] = [];
    const name = String(g.name ?? "").trim();
    const dob = String(g.date_of_birth ?? "").trim();
    const city = String(g.city ?? "").trim();
    const phone = String(g.phone ?? "").trim();
    const email = String(g.email ?? "").trim();

    if (!name)
      errors.push("Имя гостя обязательно");
    if (!dob) {
      errors.push("Дата рождения обязательна");
    }
    else if (!validateDateFormat(dob)) {
      errors.push("Неверный формат даты рождения. Ожидается DD.MM.YYYY");
    }
    if (!city)
      errors.push("Город обязателен");
    if (!phone)
      errors.push("Телефон обязателен");
    if (email && !/[^@]+@[^@]+\.[^@]+/.test(email)) {
      errors.push("Неверный формат email. Ожидается user@example.com");
    }

    let age = 0;
    if (dob && validateDateFormat(dob)) {
      try {
        age = parseDateOfBirthToAge(dob);
        if (!validateGuestAge(age)) {
          errors.push(`Гость должен быть не младше 6 лет. Текущий возраст: ${age}`);
        }
      }
      catch (e: any) {
        errors.push(e?.message ?? String(e));
      }
    }

    const row = Number(g.row ?? idx + 2);
    errors.forEach(msg => allErrors.push(makeRowError(row, msg)));

    return { row, name, date_of_birth: dob, city, phone, email, age, errors };
  });

  // Group-level age rules.
  if (booking) {
    const ageMessages = validateAgeDistribution(
      guests.map(g => ({ name: g.name, date_of_birth: g.date_of_birth, city: g.city, phone: g.phone, email: g.email, errors: g.errors })),
      booking.peopleCount,
    );
    ageMessages.forEach(msg => allErrors.push({ message: msg }));

    const [existingList] = await db.select().from(schema.guestLists).where(
      eq(schema.guestLists.bookingId, booking_id),
    ).limit(1);
    if (existingList) {
      allErrors.push({ message: "Список гостей уже существует для данного бронирования" });
    }
    else {
      const countMessages = validateGuestCount(guests.length, booking.peopleCount);
      countMessages.forEach(msg => allErrors.push({ message: msg }));
    }
  }
  else {
    setResponseStatus(event, 404);
    return { errors: ["Бронирование не найдено"] };
  }

  if (allErrors.length > 0) {
    return {
      success: true,
      preview_mode: true,
      booking_id,
      summary: {
        total_guests: guests.length,
        errors_count: allErrors.length,
        has_booking: true,
      },
      guests,
      errors: allErrors,
    };
  }

  // Create
  const [guestList] = await db.insert(schema.guestLists).values({
    bookingId: booking_id,
    source: "excel_import",
  }).returning();

  if (guests.length > 0) {
    await db.insert(schema.guests).values(guests.map(g => ({
      guestListId: guestList.id,
      name: g.name,
      dateOfBirth: g.date_of_birth,
      age: g.age,
      city: g.city,
      phone: normalizePhoneNumber(g.phone),
      email: g.email || null,
    })));
  }

  return {
    success: true,
    message: "Список гостей успешно создан",
    guest_list_id: String(guestList.id),
  };
});
