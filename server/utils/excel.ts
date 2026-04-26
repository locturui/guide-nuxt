import ExcelJS from "exceljs";

export type GuestData = {
  name: string;
  date_of_birth: string;
  city: string;
  phone: string;
  email: string;
  errors: string[];
};

export async function parseExcelFile(buffer: ArrayBuffer): Promise<{ guests: GuestData[]; errors: string[] }> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return { guests: [], errors: ["Excel файл пуст или поврежден"] };
    }

    const headers = worksheet.getRow(1).values as any[];
    const requiredColumns = ["ФИО", "Дата рождения", "Город", "Телефон"];
    const missingCols = requiredColumns.filter(col => !headers.some((h: any) => String(h ?? "").trim().toLowerCase() === col.toLowerCase()));

    if (missingCols.length > 0) {
      return {
        guests: [],
        errors: [`Excel файл должен содержать колонки: ${missingCols.join(", ")}`],
      };
    }

    const generalErrors: string[] = [];
    const guests: GuestData[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1)
        return;

      const rowErrors: string[] = [];
      const rowData: any = {};

      headers.forEach((header, index) => {
        if (header) {
          rowData[header] = row.getCell(index).value;
        }
      });

      const name = String(rowData["ФИО"] || "").trim();
      const dateOfBirth = parseDateValue(rowData["Дата рождения"]);
      const city = String(rowData["Город"] || "").trim();
      const phone = normalizePhone(String(rowData["Телефон"] || "").trim());
      const email = String(rowData["Почта"] || rowData.Email || rowData["E-mail"] || "").trim();

      if (!name)
        rowErrors.push("Имя обязательно");
      if (!dateOfBirth)
        rowErrors.push("Дата рождения обязательна");
      if (!city)
        rowErrors.push("Город обязателен");
      if (!phone)
        rowErrors.push("Номер телефона обязателен");
      if (email && !/[^@]+@[^@]+\.[^@]+/.test(email)) {
        rowErrors.push("Неверный формат email. Ожидается user@example.com");
      }

      if (dateOfBirth && !isValidDateFormat(dateOfBirth)) {
        rowErrors.push(`Неверный формат даты '${dateOfBirth}'. Ожидается DD.MM.YYYY`);
      }

      if (dateOfBirth && isValidDateFormat(dateOfBirth)) {
        const age = calculateAge(dateOfBirth);
        if (age < 6) {
          rowErrors.push(`Гость должен быть не младше 6 лет. Текущий возраст: ${age}`);
        }
      }

      guests.push({
        name,
        date_of_birth: dateOfBirth,
        city,
        phone,
        email,
        errors: rowErrors,
      });
    });

    return { guests, errors: generalErrors };
  }
  catch (error: any) {
    return { guests: [], errors: [`Ошибка при чтении Excel файла: ${error.message}`] };
  }
}

function parseDateValue(val: any): string {
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

function isValidDateFormat(dateStr: string): boolean {
  const pattern = /^\d{2}\.\d{2}\.\d{4}$/;
  if (!pattern.test(dateStr))
    return false;

  const [day, month, year] = dateStr.split(".").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getDate() === day
    && date.getMonth() === month - 1
    && date.getFullYear() === year
  );
}

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

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (!digits)
    return phone;

  if (digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.substring(1)}`;
  }
  if (digits.length === 11 && digits.startsWith("7")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }

  return phone;
}

export function validateGuestCount(guestCount: number, bookingPeopleCount: number): string[] {
  const errors: string[] = [];

  if (guestCount !== bookingPeopleCount) {
    errors.push(
      `Количество гостей в Excel (${guestCount}) должно соответствовать количеству людей в бронировании (${bookingPeopleCount})`,
    );
  }

  return errors;
}

export function validateAgeDistribution(guests: GuestData[], peopleCount?: number): string[] {
  const errors: string[] = [];
  const ages: number[] = [];

  for (const guest of guests) {
    if (guest.date_of_birth && isValidDateFormat(guest.date_of_birth)) {
      ages.push(calculateAge(guest.date_of_birth));
    }
  }

  if (ages.length === 0)
    return errors;

  const total = peopleCount ?? guests.length;
  const childrenUnder6 = ages.filter(a => a < 6).length;
  if (childrenUnder6 > 0) {
    errors.push(`Дети младше 6 лет не допускаются. Найдено: ${childrenUnder6}`);
    return errors;
  }

  if (total > 9) {
    const children6to9 = ages.filter(a => a >= 6 && a <= 9).length;
    const maxChildren = Math.floor(total / 17);
    if (children6to9 > maxChildren) {
      errors.push(`Для организованной группы из ${total} человек допускается не более ${maxChildren} детей от 6 до 9 лет. Найдено: ${children6to9}`);
    }
  }
  else {
    const adults = ages.filter(a => a >= 18).length;
    const children6to8 = ages.filter(a => a >= 6 && a <= 8).length;
    if (children6to8 > adults) {
      errors.push(`Для семейной группы требуется минимум по 1 взрослому на каждого ребенка 6-8 лет. Взрослых: ${adults}, детей 6-8 лет: ${children6to8}`);
    }
  }

  return errors;
}
