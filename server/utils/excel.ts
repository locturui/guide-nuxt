import ExcelJS from "exceljs";

export type GuestData = {
  name: string;
  date_of_birth: string;
  city: string;
  phone: string;
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
    const missingCols = requiredColumns.filter(col => !headers.includes(col));

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

      if (!name)
        rowErrors.push("Имя обязательно");
      if (!dateOfBirth)
        rowErrors.push("Дата рождения обязательна");
      if (!city)
        rowErrors.push("Город обязателен");
      if (!phone)
        rowErrors.push("Номер телефона обязателен");

      if (dateOfBirth && !isValidDateFormat(dateOfBirth)) {
        rowErrors.push(`Неверный формат даты '${dateOfBirth}'. Ожидается DD.MM.YYYY`);
      }

      if (dateOfBirth && isValidDateFormat(dateOfBirth)) {
        const age = calculateAge(dateOfBirth);
        if (age < 12) {
          rowErrors.push(`Гость должен быть не младше 12 лет. Текущий возраст: ${age}`);
        }
      }

      guests.push({
        name,
        date_of_birth: dateOfBirth,
        city,
        phone,
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

  return phone; // Return original if can't normalize
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

export function validateAgeDistribution(guests: GuestData[]): string[] {
  const errors: string[] = [];
  const ages: number[] = [];

  for (const guest of guests) {
    if (guest.date_of_birth && isValidDateFormat(guest.date_of_birth)) {
      ages.push(calculateAge(guest.date_of_birth));
    }
  }

  const adults = ages.filter(age => age >= 18).length;
  const minors = ages.filter(age => age < 18).length;

  if (minors > adults) {
    errors.push(`Количество взрослых должно быть не менее количества детей (${adults} < ${minors})`);
  }

  return errors;
}
