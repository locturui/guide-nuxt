import { and, eq } from "drizzle-orm";

import type { GuestGeneralError, GuestRowError } from "~/server/utils/guest-list-errors";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";
import { parseExcelFile, validateAgeDistribution } from "~/server/utils/excel";
import { makeRowError } from "~/server/utils/guest-list-errors";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  if (auth.role !== "agency") {
    setResponseStatus(event, 403);
    return { errors: ["Только агентства могут создавать немедленные бронирования"] };
  }

  const formData = await readFormData(event);
  const date = formData.get("date") as string;
  const time = formData.get("time") as string;
  const precise_time = (formData.get("precise_time") as string) || null;
  const peopleCountRaw = formData.get("people_count") as string | null;
  const is_radio = formData.get("is_radio") === "true";
  const curator_name = (formData.get("curator_name") as string) || null;
  const driver_name = (formData.get("driver_name") as string) || null;
  const file = formData.get("file") as File;

  if (!date || !time || !file) {
    setResponseStatus(event, 400);
    return { errors: ["date, time и файл обязательны"] };
  }

  if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
    setResponseStatus(event, 400);
    return { errors: ["Поддерживаются только файлы формата .xlsx, .xls"] };
  }

  const bookingDateTime = new Date(`${date}T${time}:00`);
  if (Number.isNaN(bookingDateTime.getTime()) || bookingDateTime <= new Date()) {
    setResponseStatus(event, 400);
    return { errors: ["Неверный формат даты/времени или время в прошлом"] };
  }

  const buffer = await file.arrayBuffer();
  const { guests, errors: parseErrors } = await parseExcelFile(buffer);
  if (parseErrors.length > 0) {
    setResponseStatus(event, 400);
    return { errors: parseErrors };
  }

  const peopleCount = peopleCountRaw ? Number.parseInt(peopleCountRaw) : guests.length;
  const allErrors: Array<GuestRowError | GuestGeneralError> = [];

  if (peopleCount !== guests.length) {
    allErrors.push({
      message: `Количество гостей в файле (${guests.length}) не соответствует указанному (${peopleCount})`,
    });
  }

  guests.forEach((g, idx) => {
    const excelRow = idx + 2;
    g.errors.forEach((msg) => {
      allErrors.push(makeRowError(excelRow, msg));
    });
  });

  const ageMessages = validateAgeDistribution(guests, peopleCount);
  ageMessages.forEach(msg => allErrors.push({ message: msg }));

  // Availability check
  const db = useDB();
  const availability: any = {};
  try {
    let [day] = await db.select().from(schema.days).where(eq(schema.days.date, date)).limit(1);
    if (!day) {
      [day] = await db.insert(schema.days).values({ date, category: "Open", limit: 51 }).returning();
      availability.day_created = true;
    }
    else {
      availability.day_created = false;
      if (day.category === "Closed") {
        allErrors.push({ message: `День ${date} закрыт для бронирований` });
      }
    }

    let [ts] = await db.select().from(schema.timeslots).where(
      and(eq(schema.timeslots.dayId, day.id), eq(schema.timeslots.time, time)),
    ).limit(1);
    if (!ts) {
      [ts] = await db.insert(schema.timeslots).values({
        dayId: day.id,
        time,
        limit: day.limit,
        limited: false,
      }).returning();
      availability.timeslot_created = true;
    }
    else {
      availability.timeslot_created = false;
    }

    const slotBookings = await db.select().from(schema.bookings).where(eq(schema.bookings.timeslotId, ts.id));
    const booked = slotBookings.reduce((s, b) => s + b.peopleCount, 0);
    const slotLimit = ts.limit ?? day.limit;
    availability.current_booked = booked;
    availability.slot_limit = slotLimit;
    availability.available = slotLimit - booked;
    if (booked + peopleCount > slotLimit) {
      allErrors.push({
        message: `Недостаточно мест. Доступно: ${slotLimit - booked}, требуется: ${peopleCount}`,
      });
    }
  }
  catch (e: any) {
    allErrors.push({ message: `Ошибка при проверке доступности: ${e.message}` });
  }

  return {
    success: true,
    preview_mode: true,
    booking_info: {
      date,
      time,
      precise_time,
      people_count: peopleCount,
      is_radio,
      curator_name,
      driver_name,
      availability,
    },
    summary: {
      total_guests: guests.length,
      errors_count: allErrors.length,
    },
    guests: guests.map((g, idx) => ({
      row: idx + 2,
      name: g.name,
      date_of_birth: g.date_of_birth,
      age: 0,
      city: g.city,
      phone: g.phone,
      email: g.email ?? "",
      errors: g.errors,
    })),
    errors: allErrors,
  };
});
