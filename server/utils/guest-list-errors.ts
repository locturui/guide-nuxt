export type GuestRowError = {
  row: number;
  column: string;
  message: string;
  severity: "error" | "warning";
  col: number | null;
};

export type GuestGeneralError = { message: string };

export function inferErrorCol(message: string): number | null {
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

export function makeRowError(row: number, message: string, sheet?: string): GuestRowError {
  const suffix = sheet ? ` (лист '${sheet}')` : "";
  return {
    row,
    column: "Гость",
    message: `${message}${suffix}`,
    severity: "error",
    col: inferErrorCol(message),
  };
}
