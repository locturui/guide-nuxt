import { and, eq } from "drizzle-orm";

import type { GuestGeneralError, GuestRowError } from "~/server/utils/guest-list-errors";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";
import { parseExcelFile, validateAgeDistribution, validateGuestCount } from "~/server/utils/excel";
import { makeRowError } from "~/server/utils/guest-list-errors";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  if (auth.role !== "agency") {
    setResponseStatus(event, 403);
    return { errors: ["Только агентства могут загружать списки гостей"] };
  }

  const formData = await readFormData(event);
  const booking_id = formData.get("booking_id") as string;
  const file = formData.get("file") as File;

  if (!booking_id || !file) {
    setResponseStatus(event, 400);
    return { errors: ["Booking ID и файл обязательны"] };
  }

  if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
    setResponseStatus(event, 400);
    return { errors: ["Поддерживаются только файлы формата .xlsx, .xls"] };
  }

  const buffer = await file.arrayBuffer();
  const { guests, errors: parseErrors } = await parseExcelFile(buffer);

  if (parseErrors.length > 0) {
    setResponseStatus(event, 400);
    return { errors: parseErrors };
  }

  const db = useDB();

  const [booking] = await db.select().from(schema.bookings).where(
    and(eq(schema.bookings.id, booking_id), eq(schema.bookings.agencyId, auth.userId)),
  ).limit(1);

  const allErrors: Array<GuestRowError | GuestGeneralError> = [];

  guests.forEach((g, idx) => {
    const excelRow = idx + 2;
    g.errors.forEach((msg) => {
      allErrors.push(makeRowError(excelRow, msg));
    });
  });

  const ageMessages = validateAgeDistribution(guests, booking?.peopleCount ?? guests.length);
  ageMessages.forEach(msg => allErrors.push({ message: msg }));

  if (booking) {
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

  return {
    success: true,
    preview_mode: true,
    booking_id,
    summary: {
      total_guests: guests.length,
      errors_count: allErrors.length,
      has_booking: !!booking,
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
