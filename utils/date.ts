export function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
export function formattedDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
export function formatISODate(d: Date) {
  return formattedDate(d);
}
export function parseSlotDate(date: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
}
export function formatRangeTitle(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const endY = end.getFullYear();
  const endM = String(end.getMonth() + 1).padStart(2, "0");
  const endD = String(end.getDate()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} - ${endD}.${endM}.${endY}`;
}
