import { eq } from "drizzle-orm";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const query = getQuery(event);
  const guest_list_id = query.guest_list_id as string;
  if (!guest_list_id) {
    setResponseStatus(event, 400);
    return { errors: ["Неверный формат ID списка гостей"] };
  }

  const db = useDB();

  const [guestList] = await db.select().from(schema.guestLists).where(eq(schema.guestLists.id, guest_list_id)).limit(1);
  if (!guestList) {
    setResponseStatus(event, 404);
    return { errors: ["Список гостей не найден"] };
  }

  await db.delete(schema.guideAssignments).where(eq(schema.guideAssignments.bookingId, guestList.bookingId));
  await db.delete(schema.guests).where(eq(schema.guests.guestListId, guestList.id));
  await db.delete(schema.guestLists).where(eq(schema.guestLists.id, guestList.id));

  return { success: true, message: "Список успешно удалён" };
});
