import { defineStore } from "pinia";

import { useApi } from "@/utils/api";

export type DailyListGuest = {
  name: string;
  date_of_birth: string;
  city: string;
  phone: string;
  email: string;
  row: number;
};

export type DailyListBookingInfo = {
  date: string;
  timeslot_time: string;
  precise_time: string;
  is_radio?: boolean;
  is_joint?: boolean;
  driver_name?: string;
  curator_name?: string;
};

export type DailyListSheetError = {
  message?: string;
  row?: number;
  col?: number;
  [key: string]: unknown;
};

export type DailyListSheet = {
  sheet_name: string;
  booking_info: DailyListBookingInfo;
  guests: Array<DailyListGuest & { errors?: string[] }>;
  sheet_errors?: DailyListSheetError[];
  [key: string]: unknown;
};

export type DailyListsPayload = {
  sheets: Array<{
    sheet_name: string;
    date: string;
    timeslot_time: string;
    precise_time: string;
    radio_guides: string;
    joint_group: string;
    driver_name: string;
    curator_name: string;
    guests: DailyListGuest[];
  }>;
};

export type DailyListsSummary = {
  total_sheets?: number;
  total_guests?: number;
  errors_count?: number;
  [key: string]: unknown;
};

export type DailyListsGlobalError = {
  message?: string;
  [key: string]: unknown;
};

export type DailyListsPreviewResponse = {
  preview_mode?: boolean;
  message?: string;
  errors?: unknown[];
  global_errors?: DailyListsGlobalError[];
  sheets?: DailyListSheet[];
  summary?: DailyListsSummary;
  [key: string]: unknown;
};

export type DailyListsConfirmResponse = {
  message?: string;
  errors?: unknown[];
  [key: string]: unknown;
};

export const useDailyListsStore = defineStore("dailyLists", () => {
  async function uploadDailyList(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    return await useApi<DailyListsPreviewResponse>("/daily-lists/daily-upload", {
      method: "POST",
      body: formData,
      headers: {},
    });
  }

  async function validateDailyLists(payload: DailyListsPayload) {
    return await useApi<DailyListsPreviewResponse>("/daily-lists/validate", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async function confirmDailyUpload(payload: DailyListsPayload) {
    return await useApi<DailyListsConfirmResponse>("/daily-lists/confirm", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  return {
    uploadDailyList,
    validateDailyLists,
    confirmDailyUpload,
  };
});
