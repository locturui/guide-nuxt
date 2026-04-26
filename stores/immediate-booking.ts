import { defineStore } from "pinia";

import { useApi } from "@/utils/api";

export type ImmediateBookingGuest = { name: string; date_of_birth: string; city: string; phone: string; email: string };

export type ImmediatePreviewResponse = {
  guests?: Array<ImmediateBookingGuest & { errors?: string[] }>;
  errors?: string[];
  detail?: string;
};

export type ImmediateBookingResponse = {
  success?: boolean;
  preview_mode?: boolean;
  booking_id?: string;
  guest_list_id?: string;
  message?: string;
  errors?: Array<string | { detail?: string; message?: string; [key: string]: unknown }>;
  guests?: Array<ImmediateBookingGuest & { errors?: string[] }>;
  booking?: { id?: string | number };
  detail?: string;
};

export const useImmediateBookingStore = defineStore("immediateBooking", () => {
  async function previewFromFile(payload: { date: string; time: string; precise_time?: string; file: File }) {
    const form = new FormData();
    form.append("date", payload.date);
    form.append("time", payload.time);
    if (payload.precise_time)
      form.append("precise_time", payload.precise_time);
    form.append("file", payload.file);

    return await useApi<ImmediatePreviewResponse>("/guest-lists-new/immediate/upload", {
      method: "POST",
      body: form,
      headers: {},
    });
  }

  async function confirmExcel(payload: {
    date: string;
    time: string;
    people_count: number;
    precise_time: string;
    is_radio: boolean;
    curator_name?: string;
    driver_name?: string;
    guests: ImmediateBookingGuest[];
  }) {
    const form = new FormData();
    form.append("date", payload.date);
    form.append("time", payload.time);
    form.append("people_count", payload.people_count.toString());
    if (payload.precise_time)
      form.append("precise_time", payload.precise_time);
    if (payload.is_radio !== undefined)
      form.append("is_radio", payload.is_radio.toString());
    if (payload.curator_name)
      form.append("curator_name", payload.curator_name);
    if (payload.driver_name)
      form.append("driver_name", payload.driver_name);
    form.append("guests", JSON.stringify(payload.guests));

    return await useApi<ImmediateBookingResponse>("/guest-lists-new/immediate/confirm", {
      method: "POST",
      body: form,
      headers: {},
    });
  }

  return {
    previewFromFile,
    confirmExcel,
  };
});
