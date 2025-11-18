export function formatPhoneInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, "");

  if (!digitsOnly) {
    return "+7";
  }

  let normalized = digitsOnly;

  if (normalized.startsWith("8")) {
    normalized = normalized.slice(1);
  }
  else if (normalized.startsWith("7")) {
    normalized = normalized.slice(1);
  }

  if (normalized.length > 10) {
    normalized = normalized.slice(0, 10);
  }

  return `+7${normalized}`;
}

export function formatDateInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, "").slice(0, 8);

  if (!digitsOnly)
    return "";

  if (digitsOnly.length <= 2)
    return digitsOnly;

  if (digitsOnly.length <= 4)
    return `${digitsOnly.slice(0, 2)}.${digitsOnly.slice(2)}`;

  return `${digitsOnly.slice(0, 2)}.${digitsOnly.slice(2, 4)}.${digitsOnly.slice(4)}`;
}
