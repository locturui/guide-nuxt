import { and, eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import {
  normalizePhoneNumber,
  parseDateOfBirthToAge,
  validateAgesFamilyGroup,
  validateAgesOrganizedGroup,
  validateDateFormat,
  validateGuestAge,
} from "~/server/utils/guest-validation";

export type DailyListError = {
  row: number;
  column: string;
  message: string;
  col: number | null;
};

export type DailyGuestInput = {
  row?: number | null;
  name: string;
  date_of_birth: string;
  city: string;
  phone: string;
  email: string;
};

export type DailySheetInput = {
  sheet_name?: string | null;
  date: string;
  timeslot_time: string;
  precise_time: string;
  radio_guides: string;
  joint_group: string;
  driver_name?: string | null;
  curator_name?: string | null;
  guests: DailyGuestInput[];
};

export type DailyValidationRequest = { sheets: DailySheetInput[] };

export type DailyGuest = {
  row: number;
  name: string;
  date_of_birth: string;
  city: string;
  phone: string;
  email: string;
  age: number;
  errors: string[];
  sheet: string;
};

export type DailyGroup = {
  sheet_name: string;
  date: string;
  timeslot_time: string;
  precise_time: string;
  is_radio: boolean;
  is_joint: boolean;
  driver_name: string;
  curator_name: string;
  guests: DailyGuest[];
};

const TRUTHY = new Set(["да", "yes", "true", "1", "истина"]);

function inferErrorCol(message: string): number | null {
  const m = message.toLowerCase();
  if (m.includes("имя"))
    return 1;
  if (m.includes("дата") || m.includes("даты") || m.includes("возраст"))
    return 2;
  if (m.includes("город"))
    return 3;
  if (m.includes("телефон"))
    return 4;
  if (m.includes("email") || m.includes("почт"))
    return 5;
  return null;
}

export function parseDailyJsonData(data: DailyValidationRequest): { groups: DailyGroup[]; errors: DailyListError[] } {
  const errors: DailyListError[] = [];
  const groups: DailyGroup[] = [];

  if (!data?.sheets || data.sheets.length === 0) {
    errors.push({ row: 0, column: "file", message: "Данные не содержат листов", col: null });
    return { groups, errors };
  }

  data.sheets.forEach((sheet, sheetIndex) => {
    try {
      const sheetName = sheet.sheet_name || `Sheet_${sheetIndex + 1}`;
      const isRadio = TRUTHY.has((sheet.radio_guides ?? "").toLowerCase().trim());
      const isJoint = TRUTHY.has((sheet.joint_group ?? "").toLowerCase().trim());

      const group: DailyGroup = {
        sheet_name: sheetName,
        date: sheet.date,
        timeslot_time: sheet.timeslot_time,
        precise_time: sheet.precise_time,
        is_radio: isRadio,
        is_joint: isJoint,
        driver_name: sheet.driver_name || "",
        curator_name: sheet.curator_name || "",
        guests: [],
      };

      sheet.guests.forEach((g, guestIdx) => {
        const excelRow = g.row ?? guestIdx + 8;
        const guestName = (g.name ?? "").trim();
        const guestDob = (g.date_of_birth ?? "").trim();
        const guestCity = (g.city ?? "").trim();
        const guestPhone = (g.phone ?? "").trim();
        const guestEmail = (g.email ?? "").trim();

        if (!guestName)
          return; // skip blank rows

        const guestErrors: string[] = [];

        if (!guestDob) {
          guestErrors.push("Дата рождения обязательна");
        }
        else if (!validateDateFormat(guestDob)) {
          guestErrors.push("Неверный формат даты рождения. Ожидается DD.MM.YYYY");
        }

        if (guestEmail && !/[^@]+@[^@]+\.[^@]+/.test(guestEmail)) {
          guestErrors.push("Неверный формат email. Ожидается user@example.com");
        }

        if (!guestCity)
          guestErrors.push("Город обязателен");
        if (!guestPhone)
          guestErrors.push("Телефон обязателен");

        let age = 0;
        if (guestDob && validateDateFormat(guestDob)) {
          try {
            age = parseDateOfBirthToAge(guestDob);
            if (!validateGuestAge(age)) {
              guestErrors.push(`Гость должен быть не младше 6 лет. Текущий возраст: ${age}`);
            }
          }
          catch (e: any) {
            guestErrors.push(e?.message ?? String(e));
          }
        }

        const normalizedPhone = guestPhone ? guestPhone.replace(/\D/g, "") : guestPhone;

        guestErrors.forEach((message) => {
          errors.push({
            row: excelRow,
            column: "Гость",
            message: `${message} (лист '${sheetName}')`,
            col: inferErrorCol(message),
          });
        });

        group.guests.push({
          row: excelRow,
          name: guestName,
          date_of_birth: guestDob,
          city: guestCity,
          phone: normalizedPhone,
          email: guestEmail,
          age,
          errors: guestErrors,
          sheet: sheetName,
        });
      });

      groups.push(group);
    }
    catch (e: any) {
      errors.push({
        row: 0,
        column: `Sheet_${sheetIndex}`,
        message: `Ошибка обработки листа: ${e?.message ?? String(e)}`,
        col: null,
      });
    }
  });

  return { groups, errors };
}

export function validateDailyGroupAgeRules(groups: DailyGroup[]): DailyListError[] {
  const errors: DailyListError[] = [];
  for (const g of groups) {
    const total = g.guests.length;
    const ages = g.guests.map(x => x.age).filter(a => a > 0);
    if (ages.length === 0)
      continue;
    const firstRow = g.guests.length > 0 ? Math.min(...g.guests.map(x => x.row)) : 0;
    if (total > 9) {
      const r = validateAgesOrganizedGroup(ages);
      if (!r.valid) {
        errors.push({ row: firstRow, column: "Возрастные правила", message: `${r.error} (лист '${g.sheet_name}')`, col: null });
      }
    }
    else {
      const r = validateAgesFamilyGroup(ages);
      if (!r.valid) {
        errors.push({ row: firstRow, column: "Возрастные правила", message: `${r.error} (лист '${g.sheet_name}')`, col: null });
      }
    }
  }
  return errors;
}

function ddmmyyyyToIso(date: string): string | null {
  if (!validateDateFormat(date))
    return null;
  const [d, m, y] = date.split(".").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function validateDateForPreview(dateStr: string): DailyListError[] {
  const errors: DailyListError[] = [];
  if (!validateDateFormat(dateStr)) {
    errors.push({ row: 1, column: "Дата", message: "Неверный формат даты. Ожидается DD.MM.YYYY", col: null });
    return errors;
  }
  const iso = ddmmyyyyToIso(dateStr)!;
  const dateObj = new Date(`${iso}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dateObj < today) {
    errors.push({ row: 1, column: "Дата", message: "Дата не может быть в прошлом", col: null });
    return errors;
  }
  const days = Math.round((dateObj.getTime() - today.getTime()) / 86400000);
  const cutoffMinutes = 20 * 60 + 30;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (days === 0) {
    errors.push({ row: 1, column: "Дата", message: "Бронирование на текущий день недоступно", col: null });
  }
  else if (days === 1 && nowMinutes >= cutoffMinutes) {
    errors.push({ row: 1, column: "Дата", message: "Бронирование на завтра доступно только до 20:30", col: null });
  }
  const max = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());
  if (dateObj > max) {
    errors.push({ row: 1, column: "Дата", message: "Дата не может быть позднее 6 месяцев от текущей даты", col: null });
  }
  return errors;
}

export function validateTimesForPreview(timeslotTime: string, preciseTime: string): DailyListError[] {
  const errors: DailyListError[] = [];
  const tsMatch = /^(\d{2}):(\d{2})$/.exec(timeslotTime ?? "");
  if (!tsMatch) {
    errors.push({ row: 2, column: "Время таймслота", message: "Неверный формат времени. Ожидается HH:MM", col: null });
  }
  else {
    const [, h, m] = tsMatch;
    const hh = Number(h);
    const mm = Number(m);
    if (mm !== 0 && mm !== 30) {
      errors.push({ row: 2, column: "Время таймслота", message: "Время таймслота должно быть в формате HH:30 или HH:00", col: null });
    }
    if (hh < 8 || hh > 19 || (hh === 19 && mm > 30)) {
      errors.push({ row: 2, column: "Время таймслота", message: "Время вне рабочих часов (8:00-19:30)", col: null });
    }
  }
  const prMatch = /^(\d{2}):(\d{2})$/.exec(preciseTime ?? "");
  if (!prMatch) {
    errors.push({ row: 3, column: "Точное время", message: "Неверный формат времени. Ожидается HH:MM", col: null });
  }
  else if (tsMatch) {
    const [, ph, pm] = prMatch;
    const [, th, tm] = tsMatch;
    const tsMin = Number(th) * 60 + Number(tm);
    const prMin = Number(ph) * 60 + Number(pm);
    if (prMin < tsMin || prMin > tsMin + 29) {
      errors.push({
        row: 3,
        column: "Точное время",
        message: "Точное время должно быть в диапазоне от времени таймслота до времени таймслота + 29 минут",
        col: null,
      });
    }
  }
  return errors;
}

export async function checkDayStatusForPreview(date: string) {
  const iso = ddmmyyyyToIso(date);
  if (!iso)
    return { exists: false, will_create: false, category: "unknown", limit: null as number | null };
  const db = useDB();
  const [day] = await db.select().from(schema.days).where(eq(schema.days.date, iso)).limit(1);
  if (day) {
    return { exists: true, will_create: false, category: day.category, limit: day.limit };
  }
  return { exists: false, will_create: true, category: "open", limit: 51 };
}

export async function checkTimeslotStatusForPreview(date: string, time: string) {
  const iso = ddmmyyyyToIso(date);
  if (!iso)
    return { exists: false, will_create: false, limit: null as number | null };
  const db = useDB();
  const [day] = await db.select().from(schema.days).where(eq(schema.days.date, iso)).limit(1);
  if (!day)
    return { exists: false, will_create: true, limit: null };
  const [ts] = await db.select().from(schema.timeslots).where(
    and(eq(schema.timeslots.dayId, day.id), eq(schema.timeslots.time, time)),
  ).limit(1);
  if (ts)
    return { exists: true, will_create: false, limit: ts.limit };
  return { exists: false, will_create: true, limit: null };
}

export async function checkBookingStatusForPreview(group: DailyGroup, agencyId: string) {
  const iso = ddmmyyyyToIso(group.date);
  const db = useDB();
  if (!iso) {
    return { action: "create", existing_booking_id: null, reason: "Invalid date", people_count: group.guests.length };
  }
  const [day] = await db.select().from(schema.days).where(eq(schema.days.date, iso)).limit(1);
  let timeslot: typeof schema.timeslots.$inferSelect | undefined;
  if (day) {
    [timeslot] = await db.select().from(schema.timeslots).where(
      and(eq(schema.timeslots.dayId, day.id), eq(schema.timeslots.time, group.timeslot_time)),
    ).limit(1);
  }

  let matched: typeof schema.bookings.$inferSelect | null = null;
  if (timeslot) {
    const slotBookings = await db.select().from(schema.bookings).where(
      and(eq(schema.bookings.timeslotId, timeslot.id), eq(schema.bookings.agencyId, agencyId)),
    );
    for (const b of slotBookings) {
      const bPrecise = (b.preciseTime ?? group.timeslot_time).slice(0, 5);
      const bookingType = group.is_joint ? "joint" : "regular";
      if (
        bPrecise === group.precise_time
        && b.isRadio === group.is_radio
        && b.bookingType === bookingType
      ) {
        const [gl] = await db.select().from(schema.guestLists).where(eq(schema.guestLists.bookingId, b.id)).limit(1);
        if (!gl) {
          matched = b;
          break;
        }
      }
    }
  }

  // Availability check
  const issues: string[] = [];
  if (timeslot && day) {
    const slotBookings = await db.select().from(schema.bookings).where(eq(schema.bookings.timeslotId, timeslot.id));
    const current = slotBookings.reduce((s, b) => s + b.peopleCount, 0);
    const limit = timeslot.limit ?? day.limit;
    if (limit === 0) {
      issues.push(`Таймслот ${group.timeslot_time} закрыт для бронирований (лимит: 0)`);
    }
    else if (!matched && current + group.guests.length > limit) {
      issues.push(`Превышен лимит таймслота. Текущая загрузка: ${current}, лимит: ${limit}, требуется: ${group.guests.length}`);
    }
    if (group.is_joint) {
      const joint = slotBookings.find(b => b.bookingType === "joint" && (b.preciseTime ?? "").slice(0, 5) === group.precise_time);
      if (joint && (!matched || joint.id !== matched.id)) {
        issues.push("На данный таймслот уже существует сборная группа");
      }
    }
  }

  if (issues.length > 0) {
    return {
      action: "error",
      existing_booking_id: null,
      reason: `Бронирование недоступно: ${issues.join("; ")}`,
      people_count: group.guests.length,
    };
  }
  if (matched) {
    return {
      action: "update",
      existing_booking_id: String(matched.id),
      reason: "Found existing booking without guests",
      people_count: group.guests.length,
    };
  }
  return {
    action: "create",
    existing_booking_id: null,
    reason: "No matching booking found",
    people_count: group.guests.length,
  };
}

export async function processGroupForPreview(group: DailyGroup, agencyId: string) {
  const sheetErrors: DailyListError[] = [];
  sheetErrors.push(...validateDateForPreview(group.date));
  sheetErrors.push(...validateTimesForPreview(group.timeslot_time, group.precise_time));

  const dayStatus = await checkDayStatusForPreview(group.date);
  const timeslotStatus = await checkTimeslotStatusForPreview(group.date, group.timeslot_time);
  const bookingStatus = await checkBookingStatusForPreview(group, agencyId);

  if (bookingStatus.action === "error") {
    sheetErrors.push({ row: 1, column: "Бронирование", message: bookingStatus.reason, col: null });
  }

  const ages: number[] = [];
  const guests = group.guests.map((gd) => {
    const errs = [...gd.errors];
    if (gd.age > 0 && gd.age < 6) {
      const m = `Гость должен быть не младше 6 лет. Текущий возраст: ${gd.age}`;
      if (!errs.includes(m))
        errs.push(m);
    }
    else if (gd.age >= 6) {
      ages.push(gd.age);
    }
    return {
      row: gd.row,
      name: gd.name,
      date_of_birth: gd.date_of_birth,
      age: gd.age,
      city: gd.city,
      phone: gd.phone,
      email: gd.email,
      errors: errs,
    };
  });

  if (ages.length > 0) {
    const total = group.guests.length;
    if (total > 9) {
      const r = validateAgesOrganizedGroup(ages);
      if (!r.valid) {
        sheetErrors.push({ row: 0, column: "Возрастные правила", message: r.error, col: null });
      }
    }
    else {
      const r = validateAgesFamilyGroup(ages);
      if (!r.valid) {
        sheetErrors.push({ row: 0, column: "Возрастные правила", message: r.error, col: null });
      }
    }
  }

  return {
    sheet_name: group.sheet_name,
    booking_info: {
      date: group.date,
      timeslot_time: group.timeslot_time,
      precise_time: group.precise_time,
      is_radio: group.is_radio,
      is_joint: group.is_joint,
      driver_name: group.driver_name,
      curator_name: group.curator_name,
      day_status: dayStatus,
      timeslot_status: timeslotStatus,
      booking_status: bookingStatus,
    },
    guests,
    sheet_errors: sheetErrors,
  };
}

export function buildPreview(groups: DailyGroup[], parseErrors: DailyListError[], sheetPreviews: Awaited<ReturnType<typeof processGroupForPreview>>[]) {
  const summary = {
    total_sheets: groups.length,
    total_groups: groups.length,
    total_guests: 0,
    created_days: 0,
    created_timeslots: 0,
    existing_bookings: 0,
    new_bookings: 0,
    updated_bookings: 0,
    errors_count: parseErrors.length,
  };
  const actions = {
    will_create: [] as any[],
    will_update: [] as any[],
    will_create_days: [] as any[],
    will_create_timeslots: [] as any[],
  };
  for (const sp of sheetPreviews) {
    summary.total_guests += sp.guests.length;
    summary.errors_count += sp.sheet_errors.length;
    const action = sp.booking_info.booking_status.action;
    if (action === "create") {
      summary.new_bookings++;
      actions.will_create.push({
        type: "booking",
        sheet: sp.sheet_name,
        date: sp.booking_info.date,
        time: sp.booking_info.timeslot_time,
        guests_count: sp.guests.length,
      });
    }
    else if (action === "update") {
      summary.updated_bookings++;
      actions.will_update.push({
        type: "booking",
        sheet: sp.sheet_name,
        booking_id: sp.booking_info.booking_status.existing_booking_id,
        date: sp.booking_info.date,
        time: sp.booking_info.timeslot_time,
        guests_count: sp.guests.length,
      });
    }
    if (sp.booking_info.day_status.will_create) {
      summary.created_days++;
      actions.will_create_days.push({
        date: sp.booking_info.date,
        category: sp.booking_info.day_status.category,
        limit: sp.booking_info.day_status.limit,
      });
    }
    if (sp.booking_info.timeslot_status.will_create) {
      summary.created_timeslots++;
      actions.will_create_timeslots.push({
        date: sp.booking_info.date,
        time: sp.booking_info.timeslot_time,
        limit: sp.booking_info.timeslot_status.limit,
      });
    }
  }

  return {
    success: true,
    preview_mode: true,
    summary,
    sheets: sheetPreviews,
    global_errors: parseErrors,
    actions_summary: actions,
  };
}

export async function createBookingAndGuestList(group: DailyGroup, agencyId: string): Promise<{ booking: any | null; errors: string[] }> {
  const db = useDB();
  const errors: string[] = [];
  const iso = ddmmyyyyToIso(group.date);
  if (!iso)
    return { booking: null, errors: [`Неверная дата: ${group.date}`] };
  try {
    let [day] = await db.select().from(schema.days).where(eq(schema.days.date, iso)).limit(1);
    if (!day) {
      [day] = await db.insert(schema.days).values({ date: iso, category: "Open", limit: 51 }).returning();
    }

    let [ts] = await db.select().from(schema.timeslots).where(
      and(eq(schema.timeslots.dayId, day.id), eq(schema.timeslots.time, group.timeslot_time)),
    ).limit(1);
    if (!ts) {
      [ts] = await db.insert(schema.timeslots).values({
        dayId: day.id,
        time: group.timeslot_time,
        limit: day.limit,
        limited: false,
      }).returning();
    }

    const [booking] = await db.insert(schema.bookings).values({
      agencyId,
      timeslotId: ts.id,
      peopleCount: group.guests.length,
      preciseTime: group.precise_time,
      bookingType: group.is_joint ? "joint" : "regular",
      isRadio: group.is_radio,
      driverName: group.driver_name || null,
      curatorName: group.curator_name || null,
    }).returning();

    const [guestList] = await db.insert(schema.guestLists).values({
      bookingId: booking.id,
      source: "excel_import",
    }).returning();

    const validGuests = group.guests.filter(g => g.errors.length === 0);
    if (validGuests.length > 0) {
      await db.insert(schema.guests).values(validGuests.map(g => ({
        guestListId: guestList.id,
        name: g.name,
        dateOfBirth: g.date_of_birth,
        age: g.age,
        city: g.city,
        phone: normalizePhoneNumber(g.phone),
        email: g.email || null,
      })));
    }

    return { booking, errors };
  }
  catch (e: any) {
    return { booking: null, errors: [`Ошибка при создании бронирования: ${e?.message ?? String(e)}`] };
  }
}

export async function updateExistingBookingWithGuestList(bookingId: string, group: DailyGroup): Promise<{ booking: any | null; errors: string[] }> {
  const db = useDB();
  const errors: string[] = [];
  try {
    await db.update(schema.bookings).set({
      peopleCount: group.guests.length,
      driverName: group.driver_name || null,
      curatorName: group.curator_name || null,
      isRadio: group.is_radio,
      preciseTime: group.precise_time,
      bookingType: group.is_joint ? "joint" : "regular",
      updatedAt: new Date(),
    }).where(eq(schema.bookings.id, bookingId));

    const [existingList] = await db.select().from(schema.guestLists).where(eq(schema.guestLists.bookingId, bookingId)).limit(1);
    if (existingList) {
      await db.delete(schema.guests).where(eq(schema.guests.guestListId, existingList.id));
      await db.delete(schema.guestLists).where(eq(schema.guestLists.id, existingList.id));
    }

    const [guestList] = await db.insert(schema.guestLists).values({
      bookingId,
      source: "excel_import",
    }).returning();

    const validGuests = group.guests.filter(g => g.errors.length === 0);
    if (validGuests.length > 0) {
      await db.insert(schema.guests).values(validGuests.map(g => ({
        guestListId: guestList.id,
        name: g.name,
        dateOfBirth: g.date_of_birth,
        age: g.age,
        city: g.city,
        phone: normalizePhoneNumber(g.phone),
        email: g.email || null,
      })));
    }

    const [booking] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId)).limit(1);
    return { booking, errors };
  }
  catch (e: any) {
    return { booking: null, errors: [`Ошибка при обновлении бронирования: ${e?.message ?? String(e)}`] };
  }
}
