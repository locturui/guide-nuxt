import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";
import { normalizePhoneNumber, parseDateOfBirthToAge, validateAgesComplete, validateDateFormat, validateGuestAge } from "~/server/utils/guest-validation";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Только агентства могут создавать немедленные бронирования",
    });
  }

  const body = await readBody(event);
  const { date, time, people_count, precise_time, guests } = body;

  if (!date || !time || !people_count || !guests || !Array.isArray(guests)) {
    throw createError({
      statusCode: 400,
      message: "Date, time, people_count, and guests array are required",
    });
  }

  const bookingDateTime = new Date(`${date}T${time}`);
  const now = new Date();

  if (bookingDateTime <= now) {
    throw createError({
      statusCode: 400,
      message: "Время бронирования должно быть в будущем",
    });
  }

  const db = useDB();

  const guestPreviews = [];
  const generalErrors: string[] = [];
  const ages: number[] = [];
  let personaErrors = 0;

  for (const guestData of guests) {
    const rowErrors: string[] = [];

    const nameRaw = String(guestData.name || "").trim();
    const dateOfBirthRaw = String(guestData.date_of_birth || "").trim();
    const cityRaw = String(guestData.city || "").trim();
    const phoneRaw = String(guestData.phone || "").trim();

    if (!nameRaw) {
      rowErrors.push("Имя обязательно");
    }
    if (!dateOfBirthRaw) {
      rowErrors.push("Дата рождения обязательна");
    }
    if (!cityRaw) {
      rowErrors.push("Город обязателен");
    }
    if (!phoneRaw) {
      rowErrors.push("Номер телефона обязателен");
    }

    let age = 0;
    if (dateOfBirthRaw && !validateDateFormat(dateOfBirthRaw)) {
      rowErrors.push(`Неверный формат даты '${dateOfBirthRaw}'. Ожидается DD.MM.YYYY`);
    }
    else if (dateOfBirthRaw) {
      try {
        age = parseDateOfBirthToAge(dateOfBirthRaw);
        ages.push(age);
        if (!validateGuestAge(age)) {
          rowErrors.push(`Гость должен быть не младше 12 лет. Текущий возраст: ${age}`);
        }
      }
      catch (error: any) {
        rowErrors.push(String(error));
      }
    }

    let normalizedPhone = phoneRaw;
    if (phoneRaw) {
      try {
        normalizedPhone = normalizePhoneNumber(phoneRaw);
      }
      catch (error: any) {
        rowErrors.push(String(error));
      }
    }

    guestPreviews.push({
      name: nameRaw,
      date_of_birth: dateOfBirthRaw,
      city: cityRaw,
      phone: normalizedPhone,
      errors: rowErrors,
    });

    if (rowErrors.length > 0) {
      personaErrors += rowErrors.length;
    }
  }

  if (guestPreviews.length !== people_count) {
    generalErrors.push(
      `Некорректное число гостей в таблице, записано: ${guestPreviews.length}, необходимо: ${people_count}`,
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

  if (generalErrors.length > 0 || personaErrors > 0) {
    setResponseStatus(event, 400);
    return {
      errors: generalErrors,
      guests: guestPreviews,
    };
  }

  let [day] = await db.select().from(schema.days).where(
    eq(schema.days.date, date),
  ).limit(1);

  if (!day) {
    [day] = await db
      .insert(schema.days)
      .values({
        date,
        category: "Open",
        limit: 51,
      })
      .returning();
  }

  let [timeslot] = await db.select().from(schema.timeslots).where(
    and(
      eq(schema.timeslots.dayId, day.id),
      eq(schema.timeslots.time, time),
    ),
  ).limit(1);

  if (!timeslot) {
    [timeslot] = await db
      .insert(schema.timeslots)
      .values({
        dayId: day.id,
        time,
        limit: day.limit,
        limited: false,
      })
      .returning();
  }

  const existingBookings = await db.select().from(schema.bookings).where(
    eq(schema.bookings.timeslotId, timeslot.id),
  );

  const booked = existingBookings.reduce((sum: number, b: any) => sum + b.peopleCount, 0);
  const slotLimit = timeslot.limit ?? day.limit;

  if (booked + people_count > slotLimit) {
    throw createError({
      statusCode: 400,
      message: `Недостаточно мест в этом временном слоте. Осталось: ${slotLimit - booked}`,
    });
  }

  const preciseTimeValue = precise_time || time;

  const [booking] = await db
    .insert(schema.bookings)
    .values({
      agencyId: auth.userId,
      timeslotId: timeslot.id,
      peopleCount: people_count,
      preciseTime: preciseTimeValue,
      bookingType: "immediate",
    })
    .returning();

  const [guestList] = await db
    .insert(schema.guestLists)
    .values({
      bookingId: booking.id,
      source: "manual",
    })
    .returning();

  for (const guestData of guests) {
    const age = parseDateOfBirthToAge(guestData.date_of_birth.trim());
    const normalizedPhone = normalizePhoneNumber(guestData.phone.trim());

    await db
      .insert(schema.guests)
      .values({
        guestListId: guestList.id,
        name: guestData.name.trim(),
        dateOfBirth: guestData.date_of_birth.trim(),
        age,
        city: guestData.city.trim(),
        phone: normalizedPhone,
      });
  }

  return {
    booking: {
      id: String(booking.id),
      date,
      time,
      people_count: booking.peopleCount,
      agency_id: String(booking.agencyId),
      timeslot_id: String(booking.timeslotId),
      precise_time: booking.preciseTime,
      status: booking.status,
    },
    guest_list: {
      id: String(guestList.id),
      booking_id: String(guestList.bookingId),
      source: guestList.source,
      created_at: guestList.createdAt.toISOString(),
      updated_at: guestList.updatedAt.toISOString(),
      guests: [],
    },
    detail: "Немедленное бронирование и список гостей успешно созданы",
  };
});
