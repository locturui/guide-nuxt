import type { DailyListSheet, DailyListsPayload } from "@/stores/daily-lists";

export type SerializedGuest = {
  name: string;
  date_of_birth: string;
  city: string;
  phone: string;
  email: string;
  row: number;
};

export type SerializedSheet = {
  sheet_name: string;
  date: string;
  timeslot_time: string;
  precise_time: string;
  radio_guides: string;
  joint_group: string;
  driver_name: string;
  curator_name: string;
  guests: SerializedGuest[];
};

export function serializeDailySheets(sheets: DailyListSheet[]): DailyListsPayload {
  return {
    sheets: sheets.map(sheet => ({
      sheet_name: sheet.sheet_name,
      date: sheet.booking_info.date,
      timeslot_time: sheet.booking_info.timeslot_time,
      precise_time: sheet.booking_info.precise_time,
      radio_guides: sheet.booking_info.is_radio ? "да" : "нет",
      joint_group: sheet.booking_info.is_joint ? "да" : "нет",
      driver_name: sheet.booking_info.driver_name || "",
      curator_name: sheet.booking_info.curator_name || "",
      guests: sheet.guests.map(guest => ({
        name: guest.name,
        date_of_birth: guest.date_of_birth,
        city: guest.city,
        phone: guest.phone,
        email: guest.email || "",
        row: guest.row,
      })),
    })),
  };
}
