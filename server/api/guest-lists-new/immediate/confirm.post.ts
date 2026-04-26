import { and, eq } from "drizzle-orm";

import type { GuestGeneralError, GuestRowError } from "~/server/utils/guest-list-errors";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";
import { validateAgeDistribution } from "~/server/utils/excel";
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
    return { errors: ["Только агентства могут создавать немедленные бронирования"] };
  }

  const formData = await readFormData(event);
  const date = formData.get("date") as string;
  const time = formData.get("time") as string;
  const preciseTime = (formData.get("precise_time") as string) || time;
  const peopleCount = Number.parseInt(formData.get("people_count") as string);
  const isRadio = formData.get("is_radio") === "true";
  const curator_name = (formData.get("curator_name") as string) || null;
  const driver_name = (formData.get("driver_name") as string) || null;
  const guestsRaw = formData.get("guests") as string;

  if (!date || !time || !guestsRaw || !peopleCount) {
    setResponseStatus(event, 400);
    return { errors: ["date, time, people_count и guests обязательны"] };
  }

  const bookingDateTime = new Date(`${date}T${time}:00`);
  if (Number.isNaN(bookingDateTime.getTime()) || bookingDateTime <= new Date()) {
    setResponseStatus(event, 400);
    return { errors: ["Время бронирования должно быть в будущем"] };
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
  const allErrors: Array<GuestRowError | GuestGeneralError> = [];

  if (guestsInput.length !== peopleCount) {
    allErrors.push({
      message: `Количество гостей (${guestsInput.length}) не соответствует указанному (${peopleCount})`,
    });
  }

  const guests = guestsInput.map((g, idx) => {
    const errors: string[] = [];
    const name = String(g.name ?? "").trim();
    const dob = String(g.date_of_birth ?? "").trim();
    const city = String(g.city ?? "").trim();
    const phone = String(g.phone ?? "").trim();
    const email = String(g.email ?? "").trim();

    if (!name)
      errors.push("Имя гостя обязательно");
    if (!dob)
      errors.push("Дата рождения обязательна");
    else if (!validateDateFormat(dob))
      errors.push("Неверный формат даты рождения. Ожидается DD.MM.YYYY");
    if (!city)
      errors.push("Город обязателен");
    if (!phone)
      errors.push("Телефон обязателен");
    if (email && !/[^@]+@[^@]+\.[^@]+/.test(email))
      errors.push("Неверный формат email. Ожидается user@example.com");

    let age = 0;
    if (dob && validateDateFormat(dob)) {
      try {
        age = parseDateOfBirthToAge(dob);
        if (!validateGuestAge(age))
          errors.push(`Гость должен быть не младше 6 лет. Текущий возраст: ${age}`);
      }
      catch (e: any) {
        errors.push(e?.message ?? String(e));
      }
    }

    const row = Number(g.row ?? idx + 2);
    errors.forEach(msg => allErrors.push(makeRowError(row, msg)));

    return { row, name, date_of_birth: dob, city, phone, email, age, errors };
  });

  const ageMessages = validateAgeDistribution(
    guests.map(g => ({ name: g.name, date_of_birth: g.date_of_birth, city: g.city, phone: g.phone, email: g.email, errors: g.errors })),
    peopleCount,
  );
  ageMessages.forEach(msg => allErrors.push({ message: msg }));

  // Availability check
  let day = (await db.select().from(schema.days).where(eq(schema.days.date, date)).limit(1))[0];
  if (!day) {
    [day] = await db.insert(schema.days).values({ date, category: "Open", limit: 51 }).returning();
  }
  let ts = (await db.select().from(schema.timeslots).where(
    and(eq(schema.timeslots.dayId, day.id), eq(schema.timeslots.time, time)),
  ).limit(1))[0];
  if (!ts) {
    [ts] = await db.insert(schema.timeslots).values({
      dayId: day.id,
      time,
      limit: day.limit,
      limited: false,
    }).returning();
  }
  const slotBookings = await db.select().from(schema.bookings).where(eq(schema.bookings.timeslotId, ts.id));
  const booked = slotBookings.reduce((s, b) => s + b.peopleCount, 0);
  const slotLimit = ts.limit ?? day.limit;
  if (booked + peopleCount > slotLimit) {
    allErrors.push({ message: `Недостаточно мест. Доступно: ${slotLimit - booked}, требуется: ${peopleCount}` });
  }

  if (allErrors.length > 0) {
    return {
      success: true,
      preview_mode: true,
      booking_info: {
        date,
        time,
        precise_time: preciseTime,
        people_count: peopleCount,
        is_radio: isRadio,
        curator_name,
        driver_name,
        availability: {
          current_booked: booked,
          slot_limit: slotLimit,
          available: slotLimit - booked,
        },
      },
      summary: {
        total_guests: guests.length,
        errors_count: allErrors.length,
      },
      guests,
      errors: allErrors,
    };
  }

  // Create booking + guest list
  const [booking] = await db.insert(schema.bookings).values({
    agencyId: auth.userId,
    timeslotId: ts.id,
    peopleCount,
    preciseTime,
    bookingType: "immediate",
    isRadio,
    curatorName: curator_name,
    driverName: driver_name,
  }).returning();

  const [guestList] = await db.insert(schema.guestLists).values({
    bookingId: booking.id,
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
    message: "Немедленное бронирование и список гостей успешно созданы",
    booking_id: String(booking.id),
    guest_list_id: String(guestList.id),
  };
});
