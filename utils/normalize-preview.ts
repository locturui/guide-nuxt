import { formatDateInput, formatPhoneInput } from "@/utils/input-format";

export type BackendGuest = {
  row?: number;
  name?: string;
  date_of_birth?: string;
  city?: string;
  phone?: string;
  email?: string;
  age?: number;
  errors?: string[];
  [key: string]: unknown;
};

export type BackendError = string | { message?: string; row?: number; col?: number; column?: string; severity?: string; [key: string]: unknown };

export type NormalizedSheetError = { row: number; col: number; message: string };

export function normalizePreviewGuests(guests: BackendGuest[]) {
  return guests.map((g, index) => ({
    ...g,
    row: g.row ?? (index + 1),
    date_of_birth: formatDateInput(g.date_of_birth || ""),
    phone: formatPhoneInput(g.phone || ""),
    email: g.email || "",
    errors: Array.isArray(g.errors) ? g.errors : [],
  }));
}

export function normalizeSheetErrors(errors: BackendError[]): NormalizedSheetError[] {
  return errors
    .filter(
      (e): e is { row: number; col: number; message?: string } =>
        typeof e === "object" && e !== null && typeof e.row === "number" && typeof e.col === "number",
    )
    .map(e => ({ row: e.row, col: e.col, message: e.message || "" }));
}

export function normalizeGeneralErrors(errors: BackendError[]): string[] {
  return errors
    .filter(e => typeof e === "string" || (typeof e === "object" && e !== null && !("row" in e)))
    .map(e => (typeof e === "string" ? e : (e as { message?: string }).message || ""))
    .filter(Boolean);
}
