function parseDateOfBirthToAge(dateOfBirthStr: string): number {
  const [day, month, year] = dateOfBirthStr.split(".").map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return Math.max(0, age);
}

function normalizePhoneNumber(phone: string): string {
  if (!phone) {
    return phone;
  }

  let normalized = phone.replace(/[\s()-]/g, "");

  normalized = normalized.replace(/[^\d+]/g, "");

  if (normalized.startsWith("+7")) {
    normalized = `8${normalized.substring(2)}`;
  }

  if (normalized.startsWith("7") && normalized.length >= 10) {
    normalized = `8${normalized.substring(1)}`;
  }

  if (normalized.startsWith("9") && normalized.length === 10) {
    normalized = `8${normalized}`;
  }

  if (!/^8\d{10}$/.test(normalized)) {
    throw new Error(`Неверный формат номера телефона: ${phone}`);
  }

  return normalized;
}

function validateDateFormat(dateStr: string): boolean {
  try {
    const parts = dateStr.split(".");
    if (parts.length !== 3) {
      return false;
    }

    const day = Number.parseInt(parts[0]);
    const month = Number.parseInt(parts[1]);
    const year = Number.parseInt(parts[2]);

    if (year < 1900 || year > new Date().getFullYear() + 1) {
      return false;
    }

    if (month < 1 || month > 12) {
      return false;
    }

    if (day < 1 || day > 31) {
      return false;
    }

    const date = new Date(year, month - 1, day);
    return (
      date.getDate() === day
      && date.getMonth() === month - 1
      && date.getFullYear() === year
    );
  }
  catch {
    return false;
  }
}

function validateGuestAge(age: number): boolean {
  return age >= 12;
}

function validateAgesComplete(ages: number[]): [boolean, number, number] {
  if (ages.length === 0) {
    return [true, -1, -1];
  }

  const adults = ages.filter(age => age >= 18).length;
  const minors = ages.filter(age => age < 18).length;

  if (adults >= minors) {
    return [true, adults, minors];
  }

  return [false, adults, minors];
}

export {
  normalizePhoneNumber,
  parseDateOfBirthToAge,
  validateAgesComplete,
  validateDateFormat,
  validateGuestAge,
};
