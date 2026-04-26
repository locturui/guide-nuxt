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
  return age >= 6;
}

/**
 * Organized group (>9 people).
 * Children 6-9 allowed at most 1 per 17 people. Children <6 forbidden.
 */
function validateAgesOrganizedGroup(ages: number[]): { valid: boolean; error: string; total: number; children6to9: number } {
  const total = ages.length;
  const childrenUnder6 = ages.filter(a => a < 6).length;
  const children6to9 = ages.filter(a => a >= 6 && a <= 9).length;

  if (childrenUnder6 > 0) {
    return { valid: false, error: `Дети младше 6 лет не допускаются. Найдено: ${childrenUnder6}`, total, children6to9 };
  }
  if (total <= 9) {
    return { valid: true, error: "", total, children6to9 };
  }
  const maxChildren = Math.floor(total / 17);
  if (children6to9 > maxChildren) {
    return {
      valid: false,
      error: `Для организованной группы из ${total} человек допускается не более ${maxChildren} детей от 6 до 9 лет. Найдено: ${children6to9}`,
      total,
      children6to9,
    };
  }
  return { valid: true, error: "", total, children6to9 };
}

/**
 * Family group (<=8 people).
 * Children 6-8 allowed at most 1 per 1 adult. Children <6 forbidden.
 */
function validateAgesFamilyGroup(ages: number[]): { valid: boolean; error: string; total: number; adults: number; children6to8: number } {
  const total = ages.length;
  const childrenUnder6 = ages.filter(a => a < 6).length;
  const adults = ages.filter(a => a >= 18).length;
  const children6to8 = ages.filter(a => a >= 6 && a <= 8).length;

  if (childrenUnder6 > 0) {
    return { valid: false, error: `Дети младше 6 лет не допускаются. Найдено: ${childrenUnder6}`, total, adults, children6to8 };
  }
  if (children6to8 > adults) {
    return {
      valid: false,
      error: `Для семейной группы требуется минимум по 1 взрослому на каждого ребенка 6-8 лет. Взрослых: ${adults}, детей 6-8 лет: ${children6to8}`,
      total,
      adults,
      children6to8,
    };
  }
  return { valid: true, error: "", total, adults, children6to8 };
}

/**
 * Apply correct validation based on group size.
 */
function validateGroupAgeRules(ages: number[], peopleCount: number): { valid: boolean; error: string } {
  if (peopleCount > 9) {
    const r = validateAgesOrganizedGroup(ages);
    return { valid: r.valid, error: r.error };
  }
  const r = validateAgesFamilyGroup(ages);
  return { valid: r.valid, error: r.error };
}

/** @deprecated use validateGroupAgeRules. Kept for backward compat. */
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
  validateAgesFamilyGroup,
  validateAgesOrganizedGroup,
  validateDateFormat,
  validateGroupAgeRules,
  validateGuestAge,
};
