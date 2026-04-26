type GuestRow = {
  name?: string;
  date_of_birth?: string;
  city?: string;
  phone?: string;
  email?: string;
  errors?: string[];
  row?: number;
};

type SheetError = {
  row: number;
  col: number;
  message: string;
};

export function getColumnErrorText(
  row: GuestRow,
  column: number,
  sheetErrors: SheetError[] = [],
): string {
  const errs = Array.isArray(row?.errors) ? row.errors : [];

  const guestErrors = errs.filter((error: string) => {
    if (error.toLowerCase().includes("имя"))
      return column === 1;
    if (error.toLowerCase().includes("дата") || error.toLowerCase().includes("возраст"))
      return column === 2;
    if (error.toLowerCase().includes("город"))
      return column === 3;
    if (error.toLowerCase().includes("телефон"))
      return column === 4;
    if (error.toLowerCase().includes("email"))
      return column === 5;
    return false;
  });

  if (guestErrors.length > 0) {
    return guestErrors.join("\n");
  }

  const columnErrors = sheetErrors.filter(error =>
    error.row === row.row && error.col === column,
  );

  if (columnErrors.length > 0) {
    return columnErrors.map(error => error.message).join("\n");
  }

  return "";
}

export function hasColumnError(
  row: GuestRow,
  column: number,
  sheetErrors: SheetError[] = [],
): boolean {
  return getColumnErrorText(row, column, sheetErrors).length > 0;
}

export function getCellErrorClass(
  row: GuestRow,
  column: number,
  sheetErrors: SheetError[] = [],
): string {
  return hasColumnError(row, column, sheetErrors) ? "gl-cell--error" : "";
}

export function isMobile(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.innerWidth < 768;
}
