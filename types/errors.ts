export type ApiError<TData = unknown> = {
  response?: { status?: number };
  data?: TData;
  message?: string;
};

export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

export function asApiError<TData = unknown>(err: unknown): ApiError<TData> {
  return err as ApiError<TData>;
}

export function extractErrorMessage(err: unknown, fallback: string): string {
  const e = err as { data?: { detail?: unknown; message?: unknown; errors?: unknown }; message?: unknown };

  if (e?.data?.errors && Array.isArray(e.data.errors)) {
    return e.data.errors.map(v => String(v)).join(", ");
  }

  const msg = e?.data?.detail ?? e?.data?.message ?? e?.message;
  if (typeof msg === "string") {
    return msg;
  }
  if (Array.isArray(msg)) {
    return msg.map(v => String(v)).join(", ");
  }
  return fallback;
}

export function toErrorString(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(v => String(v)).join(", ");
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}
