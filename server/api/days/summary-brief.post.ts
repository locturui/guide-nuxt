import Docxtemplater from "docxtemplater";
import { eq, inArray } from "drizzle-orm";
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

  const [day] = await db.select().from(schema.days).where(
    eq(schema.days.date, date),
  ).limit(1);

  if (!day) {
    throw createError({
      statusCode: 404,
      message: "Day not found",
    });
  }

  const timeslots = await db.select().from(schema.timeslots).where(
    eq(schema.timeslots.dayId, day.id),
  );

  if (timeslots.length === 0) {
    throw createError({
      statusCode: 404,
      message: "No timeslots found for this day",
    });
  }

  const timeslotIds = timeslots.map(ts => ts.id);

  const bookings = await db.select().from(schema.bookings).where(
    inArray(schema.bookings.timeslotId, timeslotIds),
  );

  const summaryBookings = [];

  for (const booking of bookings) {
    const timeslot = timeslots.find(ts => ts.id === booking.timeslotId);
    if (!timeslot)
      continue;

    const guideAssignments = await db.select().from(schema.guideAssignments).where(
      eq(schema.guideAssignments.bookingId, booking.id),
    );

    if (guideAssignments.length === 0)
      continue;

    const guides = [];
    for (const ga of guideAssignments) {
      const [guide] = await db.select().from(schema.guides).where(
        eq(schema.guides.id, ga.guideId),
      ).limit(1);
      if (guide) {
        guides.push({
          name: guide.name,
          lastname: guide.lastname,
          badge: "",
        });
      }
    }

    if (guides.length === 0)
      continue;

    const timeValue = booking.preciseTime || timeslot.time;
    let formattedTime = timeValue;

    if (timeValue && typeof timeValue === "string" && timeValue.includes(":")) {
      const parts = timeValue.split(":");
      formattedTime = `${parts[0]}:${parts[1]}`;
    }
    else if (timeValue && typeof timeValue === "object") {
      formattedTime = `${String(timeValue.hours || 0).padStart(2, "0")}:${String(timeValue.minutes || 0).padStart(2, "0")}`;
    }

    summaryBookings.push({
      precise_time: formattedTime || "00:00",
      guides,
      people_count: String(booking.peopleCount || "0"),
    });
  }

  summaryBookings.sort((a, b) => {
    const timeA = a.precise_time || "00:00";
    const timeB = b.precise_time || "00:00";
    return timeA.localeCompare(timeB);
  });

  const [year, month, dayNum] = date.split("-");
  const formattedDate = `${dayNum}.${month}.${year}`;

  const summaryData = {
    general: {
      date: formattedDate,
      bookings: summaryBookings,
    },
  };

  const templatePath = join(process.cwd(), "server", "static", "security_template_1.docx");

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
      "Content-Disposition": `attachment; filename="security_summary_brief_${date}.docx"`,
    });

    return buf;
  }
  catch (error: any) {
    console.error("Error generating DOCX:", error);

    const separator = "=".repeat(80);
    let reportText = `Сводка для охраны (краткая)\nДата: ${formattedDate}\n\n`;
    reportText += "Время | Гид | Количество гостей\n";
    reportText += `${separator}\n`;

    for (const booking of summaryBookings) {
      const guideNames = booking.guides.map((g: any) => `${g.lastname} ${g.name}${g.badge}`).join(", ");
      reportText += `${booking.precise_time} | ${guideNames} | ${booking.people_count}\n`;
    }

    setResponseHeaders(event, {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="security_summary_brief_${date}.txt"`,
    });

    return reportText;
  }
});
