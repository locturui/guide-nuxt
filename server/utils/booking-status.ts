import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";

export async function calculateBookingStatus(bookingId: string): Promise<"booked" | "filled" | "assigned"> {
  const db = useDB();

  const [guestList] = await db.select().from(schema.guestLists).where(
    eq(schema.guestLists.bookingId, bookingId),
  ).limit(1);

  if (!guestList) {
    return "booked";
  }

  const [booking] = await db.select().from(schema.bookings).where(
    eq(schema.bookings.id, bookingId),
  ).limit(1);

  if (!booking) {
    return "booked";
  }

  const guideAssignments = await db.select().from(schema.guideAssignments).where(
    eq(schema.guideAssignments.bookingId, bookingId),
  );

  const requiredGuides = Math.max(1, Math.ceil(booking.peopleCount / 17));
  const assignedGuides = guideAssignments.length;

  if (assignedGuides >= requiredGuides) {
    return "assigned";
  }

  return "filled";
}
