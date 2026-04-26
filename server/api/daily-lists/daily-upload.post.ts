import ExcelJS from "exceljs";

import type { DailySheetInput } from "~/server/utils/daily-lists";

import { requireAuth } from "~/server/utils/auth";
import {
  buildPreview,
  parseDailyJsonData,
  processGroupForPreview,
  validateDailyGroupAgeRules,
} from "~/server/utils/daily-lists";

/**
 * Parse a multi-sheet daily list Excel file and return a preview.
 *
 * Expected layout per sheet (rows 1-indexed, column B = 2):
 *   B1: Дата (DD.MM.YYYY or Date)
 *   B2: Время таймслота (HH:MM)
 *   B3: Точное время (HH:MM)
 *   B4: Радиогиды (да/нет)
 *   B5: Сборная (да/нет)
 *   B6: Водитель
 *   B7: Сопровождающий
 *   row >=8: header row matching one of [Имя, Дата рождения, Город, Телефон, Почта]
 *   then guest rows (cols A..E).
 */
export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  const form = await readMultipartFormData(event);
  const filePart = form?.find(p => p.name === "file");
  if (!filePart?.data) {
    setResponseStatus(event, 400);
    return { errors: [{ message: "Файл не загружен" }] };
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(filePart.data as unknown as ArrayBuffer);
  }
  catch {
    setResponseStatus(event, 400);
    return { errors: [{ message: "Не удалось прочитать .xlsx файл" }] };
  }

  if (wb.worksheets.length === 0) {
    return { preview_mode: true, sheets: [], summary: { total_sheets: 0, total_guests: 0, errors_count: 1 }, global_errors: [{ message: "Файл не содержит листов" }] };
  }

  const sheets: DailySheetInput[] = [];
  const globalErrors: { message: string; sheet?: string }[] = [];

  for (const ws of wb.worksheets) {
    const sheetName = ws.name;
    if (ws.actualRowCount < 8) {
      globalErrors.push({ message: `Лист '${sheetName}' содержит недостаточно строк`, sheet: sheetName });
      continue;
    }

    const rawCell = (row: number) => ws.getCell(row, 2).value;

    const cellAsDateString = (row: number) => {
      const c = rawCell(row);
      if (c == null)
        return "";
      if (c instanceof Date) {
        const dd = String(c.getUTCDate()).padStart(2, "0");
        const mm = String(c.getUTCMonth() + 1).padStart(2, "0");
        const yy = c.getUTCFullYear();
        return `${dd}.${mm}.${yy}`;
      }
      if (typeof c === "object" && "text" in (c as any))
        return String((c as any).text ?? "").trim();
      return String(c).trim();
    };

    const cellAsTimeString = (row: number) => {
      const c = rawCell(row);
      if (c == null)
        return "";
      if (c instanceof Date) {
        // Excel time-only cells use 1899-12-30 epoch; UTC getters avoid TZ skew.
        const hh = String(c.getUTCHours()).padStart(2, "0");
        const mm = String(c.getUTCMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
      }
      if (typeof c === "number") {
        // Excel serial: fractional part is time-of-day.
        const totalMin = Math.round((c - Math.floor(c)) * 24 * 60);
        const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
        const mm = String(totalMin % 60).padStart(2, "0");
        return `${hh}:${mm}`;
      }
      if (typeof c === "object" && "text" in (c as any))
        return normalizeTime(String((c as any).text ?? "").trim());
      return normalizeTime(String(c).trim());
    };

    const cellText = (row: number) => {
      const c = rawCell(row);
      if (c == null)
        return "";
      if (c instanceof Date)
        return cellAsDateString(row);
      if (typeof c === "object" && "text" in (c as any))
        return String((c as any).text ?? "").trim();
      return String(c).trim();
    };

    let date_raw = cellAsDateString(1);
    // Coerce ISO date "YYYY-MM-DD..." into "DD.MM.YYYY"
    const iso = date_raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso)
      date_raw = `${iso[3]}.${iso[2]}.${iso[1]}`;

    const timeslot_time = cellAsTimeString(2);
    const precise_time = cellAsTimeString(3);
    const radio_guides = cellText(4);
    const joint_group = cellText(5);
    const driver_name = cellText(6);
    const curator_name = cellText(7);

    // Find guest header row (search rows 8..N).
    const guestHeaderTokens = ["имя", "дата рождения", "город", "телефон", "почта"];
    let headerRow = -1;
    const lastRow = ws.actualRowCount;
    for (let r = 8; r <= lastRow; r++) {
      const row = ws.getRow(r);
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value;
        if (v != null)
          cells.push(String((v as any).text ?? v).toLowerCase().trim());
      });
      if (cells.length === 0)
        continue;
      const matched = cells.some(c => guestHeaderTokens.some(t => c.includes(t)));
      if (matched) {
        headerRow = r;
        break;
      }
    }

    if (headerRow === -1) {
      globalErrors.push({ message: `На листе '${sheetName}' не найдена таблица с гостями`, sheet: sheetName });
      continue;
    }

    const guests: DailySheetInput["guests"] = [];
    for (let r = headerRow + 1; r <= lastRow; r++) {
      const row = ws.getRow(r);
      const cellAt = (col: number) => {
        const v = row.getCell(col).value;
        if (v == null)
          return "";
        if (v instanceof Date) {
          const dd = String(v.getUTCDate()).padStart(2, "0");
          const mm = String(v.getUTCMonth() + 1).padStart(2, "0");
          const yy = v.getUTCFullYear();
          return `${dd}.${mm}.${yy}`;
        }
        if (typeof v === "object" && "text" in (v as any))
          return String((v as any).text ?? "").trim();
        return String(v).trim();
      };

      const name = cellAt(1);
      const date_of_birth = cellAt(2);
      const city = cellAt(3);
      const phone = cellAt(4);
      const email = cellAt(5);

      // Skip blank rows.
      if (!name && !date_of_birth && !city && !phone && !email)
        continue;

      guests.push({ row: r, name, date_of_birth, city, phone, email });
    }

    sheets.push({
      sheet_name: sheetName,
      date: date_raw,
      timeslot_time,
      precise_time,
      radio_guides,
      joint_group,
      driver_name,
      curator_name,
      guests,
    });
  }

  // Reuse JSON validation pipeline.
  const { groups, errors: parseErrors } = parseDailyJsonData({ sheets });
  parseErrors.push(...validateDailyGroupAgeRules(groups));
  const sheetPreviews = await Promise.all(groups.map(g => processGroupForPreview(g, auth.userId)));

  const preview = buildPreview(groups, parseErrors, sheetPreviews);

  // Surface workbook-level issues that prevented sheets from being parsed.
  if (globalErrors.length > 0) {
    (preview as any).global_errors = [...((preview as any).global_errors ?? []), ...globalErrors];
    if (preview.summary)
      preview.summary.errors_count += globalErrors.length;
  }

  return preview;
});

function normalizeTime(raw: string): string {
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m)
    return raw;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}
