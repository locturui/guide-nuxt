export const HALF_HOUR_RE = /^([01]\d|2[0-3]):(00|30)$/;

export function isHalfHour(t: string): boolean {
  return HALF_HOUR_RE.test(t);
}

export function roundToHalfHour(t: string): string {
  const [hStr, mStr] = (t || "").split(":");
  let h = Number(hStr);
  let m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m))
    return t;

  if (m < 15) {
    m = 0;
  }
  else if (m < 45) {
    m = 30;
  }
  else {
    m = 0;
    h = (h + 1) % 24;
  }

  return `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
}
