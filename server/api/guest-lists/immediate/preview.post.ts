import ExcelJS from "exceljs";

import { requireAuth } from "~/server/utils/auth";
import { normalizePhoneNumber, parseDateOfBirthToAge, validateDateFormat, validateGuestAge } from "~/server/utils/guest-validation";

function parseExcelDateValue(val: any): string {
  if (!val)
    return "";

  if (typeof val === "string") {
    return val.trim();
  }

  if (val instanceof Date) {
    return `${String(val.getDate()).padStart(2, "0")}.${String(val.getMonth() + 1).padStart(2, "0")}.${val.getFullYear()}`;
  }

  if (typeof val === "number") {
    const date = new Date((val - 25569) * 86400 * 1000);
    return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
  }

  return String(val).trim();
}

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);

  if (auth.role !== "agency") {
    throw createError({
      statusCode: 403,
      message: "Только агентства могут просматривать импорт гостей",
    });
  }

  const formData = await readFormData(event);
  const date = formData.get("date") as string;
  const time = formData.get("time") as string;
  const file = formData.get("file") as File;

  if (!date || !time || !file) {
    throw createError({
      statusCode: 400,
      message: "Date, time, and file are required",
    });
  }

  try {
    const buffer = await file.arrayBuffer();
    let df: ExcelJS.Worksheet | null = null;

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      df = workbook.worksheets[0] || null;
    }
    catch {
      throw createError({
        statusCode: 400,
        message: "Не удалось распознать файл (поддерживаются Excel/CSV)",
      });
    }

    if (!df) {
      throw createError({
        statusCode: 400,
        message: "Не удалось распознать файл (поддерживаются Excel/CSV)",
      });
    }

    const RU_COLS = ["ФИО", "Дата рождения", "Город", "Телефон"];
    const guests: any[] = [];

    const headers = df.getRow(1).values as any[];
    const hasRussianCols = RU_COLS.every(col => headers.includes(col));

    if (hasRussianCols) {
      df.eachRow((row, rowNumber) => {
        if (rowNumber === 1)
          return;

        const rowData: any = {};
        headers.forEach((header, index) => {
          if (header) {
            rowData[header] = row.getCell(index).value;
          }
        });

        const nameRaw = String(rowData["ФИО"] || "").trim();
        const dobRaw = parseExcelDateValue(rowData["Дата рождения"]);
        const cityRaw = String(rowData["Город"] || "").trim();
        const phoneRaw = String(rowData["Телефон"] || "").trim();

        guests.push({
          name: nameRaw,
          date_of_birth: dobRaw,
          city: cityRaw,
          phone: phoneRaw,
          errors: [],
        });
      });
    }
    else {
      const normalizedHeaders = headers.map((h: any) => String(h || "").trim().toLowerCase());
      const findCol = (candidates: string[]): number => {
        for (let i = 0; i < normalizedHeaders.length; i++) {
          const h = normalizedHeaders[i];
          for (const cand of candidates) {
            if (h.includes(cand)) {
              return i;
            }
          }
        }
        return -1;
      };

      const colName = findCol(["name", "имя"]);
      const colDob = findCol(["date_of_birth", "date of birth", "дата", "др", "birth"]);
      const colCity = findCol(["city", "город"]);
      const colPhone = findCol(["phone", "тел", "номер", "telephone"]);

      if (colName === -1 || colDob === -1 || colCity === -1 || colPhone === -1) {
        setResponseStatus(event, 400);
        return {
          guests: [],
          errors: ["Excel должен содержать колонки: ФИО, Дата рождения, Город, Телефон"],
        };
      }

      df.eachRow((row, rowNumber) => {
        if (rowNumber === 1)
          return;

        const nameRaw = String(row.getCell(colName).value || "").trim();
        const dobCell = row.getCell(colDob).value;
        const dobRaw = parseExcelDateValue(dobCell);
        const cityRaw = String(row.getCell(colCity).value || "").trim();
        const phoneRaw = String(row.getCell(colPhone).value || "").trim();

        guests.push({
          name: nameRaw,
          date_of_birth: dobRaw,
          city: cityRaw,
          phone: phoneRaw,
          errors: [],
        });
      });
    }

    const generalErrors: string[] = [];
    const ages: number[] = [];

    for (const g of guests) {
      const rowErrors: string[] = [];

      if (!g.name) {
        rowErrors.push("Имя обязательно");
      }
      if (!g.date_of_birth) {
        rowErrors.push("Дата рождения обязательна");
      }
      if (!g.city) {
        rowErrors.push("Город обязателен");
      }
      if (!g.phone) {
        rowErrors.push("Номер телефона обязателен");
      }

      if (g.date_of_birth && !validateDateFormat(g.date_of_birth)) {
        rowErrors.push(`Неверный формат даты '${g.date_of_birth}'. Ожидается DD.MM.YYYY`);
      }
      else if (g.date_of_birth) {
        try {
          const age = parseDateOfBirthToAge(g.date_of_birth);
          ages.push(age);
          if (!validateGuestAge(age)) {
            rowErrors.push(`Гость должен быть не младше 12 лет. Текущий возраст: ${age}`);
          }
        }
        catch (error: any) {
          rowErrors.push(String(error));
        }
      }

      if (g.phone) {
        try {
          g.phone = normalizePhoneNumber(g.phone);
        }
        catch (error: any) {
          rowErrors.push(String(error));
        }
      }

      g.errors = rowErrors;
    }

    return {
      guests,
      errors: generalErrors,
    };
  }
  catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 400,
      message: `Ошибка при обработке Excel файла: ${error.message}`,
    });
  }
});
