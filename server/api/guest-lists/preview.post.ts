import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAuth } from "~/server/utils/auth";
import { parseExcelFile, validateAgeDistribution, validateGuestCount } from "~/server/utils/excel";
import { previewManager } from "~/server/utils/preview-manager";

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Only agencies can preview guest lists",
    });
  }

  const formData = await readFormData(event);
  const booking_id = formData.get("booking_id") as string;
  const file = formData.get("file") as File;

  if (!booking_id || !file) {
    throw createError({
      statusCode: 400,
      message: "Booking ID and file are required",
    });
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
      message: "Booking not found or doesn't belong to your agency",
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

  if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
    throw createError({
      statusCode: 400,
      message: "Файл должен быть в формате Excel (.xlsx или .xls)",
    });
  }

  const buffer = await file.arrayBuffer();
  const { guests, errors: parseErrors } = await parseExcelFile(buffer);

  if (parseErrors.length > 0) {
    setResponseStatus(event, 400);
    return {
      booking_id,
      guests: [],
      errors: parseErrors,
    };
  }

  const generalErrors: string[] = [];

  const countErrors = validateGuestCount(guests.length, booking.peopleCount);
  if (countErrors.length > 0) {
    generalErrors.push(...countErrors);
  }

  const ageErrors = validateAgeDistribution(guests);
  if (ageErrors.length > 0) {
    generalErrors.push(...ageErrors);
  }

  const previewData = {
    booking_id,
    agency_id: auth.userId.toString(),
    guest_previews: guests,
    general_errors: generalErrors,
  };

  const preview_id = previewManager.createPreviewSession(previewData);

  const hasGuestErrors = guests.some(g => g.errors.length > 0);
  const hasErrors = generalErrors.length > 0 || hasGuestErrors;

  if (hasErrors) {
    setResponseStatus(event, 400);
    return {
      booking_id,
      preview_id,
      guests,
      errors: generalErrors,
    };
  }

  return {
    booking_id,
    preview_id,
    guests,
    errors: [],
  };
});
