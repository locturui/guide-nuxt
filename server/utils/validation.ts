export function isBookingAllowed(requestedDate: string, requestedTime: string): boolean {
  const reqDate = new Date(requestedDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (reqDate < today) {
    return false;
  }

  if (reqDate.getTime() === today.getTime()) {
    const [hours, minutes] = requestedTime.split(":").map(Number);
    const reqDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

    if (reqDateTime <= now) {
      return false;
    }
  }

  return true;
}
