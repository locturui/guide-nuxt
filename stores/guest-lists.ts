import { defineStore } from "pinia";
import { reactive } from "vue";

import type {
  GuestListByBookingResponse,
  GuestListPreviewResponse,
} from "@/types/api";
import type { Guest, GuestList } from "@/types/domain";

import { useScheduleStore } from "@/stores/schedule";
import { useApi } from "@/utils/api";

type BookingGuestListState = {
  list: GuestList | null;
  loading: boolean;
  error: string | null;
};

export const useGuestListsStore = defineStore("guestLists", () => {
  const byBookingId = reactive<Record<string, BookingGuestListState>>({});

  function extractErrorMessage(err: unknown, fallback: string) {
    const e = err as { data?: { detail?: string; message?: string; errors?: string[] }; message?: string };

    if (e?.data?.errors && Array.isArray(e.data.errors) && e.data.errors.length > 0) {
      return e.data.errors.join(", ");
    }
    const msg = e?.data?.detail || e?.data?.message || e?.message;
    return typeof msg === "string" ? msg : fallback;
  }

  function ensureState(bookingId: string | number): BookingGuestListState {
    const key = String(bookingId);
    if (!byBookingId[key]) {
      byBookingId[key] = { list: null, loading: false, error: null };
    }
    return byBookingId[key];
  }

  async function fetchByBooking(bookingId: string | number): Promise<GuestList | null> {
    const st = ensureState(bookingId);
    st.loading = true;
    st.error = null;
    try {
      const res = await useApi<GuestListByBookingResponse>("/guest-lists/booking", {
        method: "POST",
        body: { booking_id: String(bookingId) },
      });
      st.list = res.guest_list;
      return st.list;
    }
    catch (err: unknown) {
      const errorMsg = extractErrorMessage(err, "Не удалось загрузить список гостей");
      st.error = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
      st.list = null;
      return null;
    }
    finally {
      st.loading = false;
    }
  }

  async function previewExcel(booking_id: string | number, file: File) {
    const form = new FormData();
    form.append("booking_id", String(booking_id));
    form.append("file", file);
    return await useApi<GuestListPreviewResponse>("/guest-lists-new/upload", {
      method: "POST",
      body: form,
      headers: {},
    });
  }

  async function confirmExcel(preview_id: string, booking_id: string | number, guests: Guest[]) {
    return await useApi<GuestListPreviewResponse>("/guest-lists-new/confirm", {
      method: "POST",
      body: {
        preview_id,
        booking_id: String(booking_id),
        guests: guests.map(g => ({
          name: g.name,
          date_of_birth: g.date_of_birth,
          city: g.city,
          phone: g.phone,
          email: g.email || "",
        })),
      },
    });
  }

  function hasGuestList(bookingId: string | number): boolean {
    const state = byBookingId[String(bookingId)];

    if (state !== undefined) {
      return state.list != null && Array.isArray(state.list.guests) && state.list.guests.length > 0;
    }

    const scheduleStore = useScheduleStore();
    const booking = scheduleStore.allBookings.find(b => String(b.id) === String(bookingId));
    if (booking && (booking.status === "filled" || booking.status === "assigned")) {
      return true;
    }

    return false;
  }

  function setListForBooking(bookingId: string | number, list: GuestList | null) {
    const st = ensureState(bookingId);
    st.list = list;
  }

  async function deleteAdminGuestList(bookingId: string | number) {
    const bookingIdStr = String(bookingId);
    const state = byBookingId[bookingIdStr];
    const guestListId = state?.list?.id;
    if (!guestListId) {
      throw new Error("Список гостей не найден для этого бронирования");
    }
    return await useApi(`/guest-lists-new/admin/guest-list?guest_list_id=${guestListId}`, {
      method: "DELETE",
    });
  }

  async function deleteAdminGuest(guestId: string | number) {
    return await useApi(`/guest-lists-new/admin/guests/${guestId}`, {
      method: "DELETE",
    });
  }

  return {
    byBookingId,
    fetchByBooking,
    previewExcel,
    confirmExcel,
    hasGuestList,
    setListForBooking,
    deleteAdminGuestList,
    deleteAdminGuest,
  };
});
