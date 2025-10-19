import Docxtemplater from "docxtemplater";
import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import PizZip from "pizzip";

import { schema, useDB } from "~/server/db";
import { requireAdmin } from "~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);
  const { date } = body;

  if (!date) {
    throw createError({
      statusCode: 400,
      message: "Date is required",
    });
  }

  const db = useDB();

  const bookings = await db.select().from(schema.bookings).where(
    eq(schema.bookings.date, date),
  );

  const summaryBookings = [];

  for (const booking of bookings as any[]) {
    const [guideAssignment] = await db.select().from(schema.guideAssignments).where(
      eq(schema.guideAssignments.bookingId, booking.id),
    ).limit(1);

    if (!guideAssignment)
      continue;

    const [guide] = await db.select().from(schema.guides).where(
      eq(schema.guides.id, guideAssignment.guideId),
    ).limit(1);

    if (!guide)
      continue;

    const [guestList] = await db.select().from(schema.guestLists).where(
      eq(schema.guestLists.bookingId, booking.id),
    ).limit(1);

    if (!guestList)
      continue;

    const guests = await db.select().from(schema.guests).where(
      eq(schema.guests.guestListId, guestList.id),
    );

    if (guests.length === 0)
      continue;

    const guestListData = (guests as any[]).map((g, idx) => ({
      index: idx + 1,
      name: g.name,
    }));

    const timeValue = booking.preciseTime || booking.time;
    let formattedTime = timeValue;

    if (timeValue && timeValue.includes(":")) {
      const parts = timeValue.split(":");
      formattedTime = `${parts[0]}:${parts[1]}`;
    }

    summaryBookings.push({
      precise_time: formattedTime || "00:00",
      guide_name: guide.name,
      guide_lastname: guide.lastname,
      guide_badge: guide.badgeNumber ? `, №${guide.badgeNumber}` : "",
      guest_list: guestListData,
    });
  }

  summaryBookings.sort((a, b) => {
    const timeA = a.precise_time || "00:00";
    const timeB = b.precise_time || "00:00";
    return timeA.localeCompare(timeB);
  });

  const [year, month, day] = date.split("-");
  const formattedDate = `${day}.${month}.${year}`;

  const summaryData = {
    date: formattedDate,
    bookings: summaryBookings,
  };

  const templatePath = join(process.cwd(), "server", "static", "security_template.docx");

  try {
    const content = await readFile(templatePath);
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: "{",
        end: "}",
      },
    });

    doc.render(summaryData);

    const buf = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    setResponseHeaders(event, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="security_summary_${date}.docx"`,
    });

    return buf;
  }
  catch (error: any) {
    console.error("Error generating DOCX:", error);

    const separator = "=".repeat(80);
    let reportText = `Сводка для охраны\nДата: ${formattedDate}\n\n`;
    reportText += "Время | Гид | Список гостей\n";
    reportText += `${separator}\n`;

    for (const booking of summaryBookings) {
      const guestNames = booking.guest_list.map((g: any) => `${g.index}. ${g.name}`).join(", ");
      reportText += `${booking.precise_time} | ${booking.guide_name} ${booking.guide_lastname}${booking.guide_badge} | ${guestNames}\n`;
    }

    setResponseHeaders(event, {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="security_summary_${date}.txt"`,
    });

    return reportText;
  }
});
