import { defineStore } from "pinia";
import { reactive } from "vue";

import { useScheduleStore } from "@/stores/schedule";
import { useApi } from "@/utils/api";

export type Guest = {
  id?: string;
  name: string;
  date_of_birth: string;
  age?: number;
  city: string;
  phone: string;
  created_at?: string;
  updated_at?: string;
  errors?: string[];
};

export type GuestList = {
  id: string;
  booking_id: string;
  source: string;
  created_at: string;
  updated_at: string;
  guests: Guest[];
  guide_id?: string;
};

type BookingGuestListState = {
  list: GuestList | null;
  loading: boolean;
  error: string | null;
};

export const useGuestListsStore = defineStore("guestLists", () => {
  const byBookingId = reactive<Record<string | number, BookingGuestListState>>({});

  function ensureState(bookingId: string | number): BookingGuestListState {
    if (!byBookingId[bookingId]) {
      byBookingId[bookingId] = { list: null, loading: false, error: null };
    }
    return byBookingId[bookingId];
  }

  async function fetchByBooking(bookingId: string | number) {
    const st = ensureState(bookingId);
    st.loading = true;
    st.error = null;
    try {
      const res = await useApi("/guest-lists/booking", {
        method: "POST",
        body: { booking_id: String(bookingId) },
      }) as { guest_list?: GuestList } | null;
      if (res?.guest_list) {
        st.list = res.guest_list;
      }
      else {
        st.list = null;
      }
    }
    catch (e: any) {
      const errorMsg = e?.data?.detail || e?.data?.message || e?.message || "Не удалось загрузить список гостей";
      st.error = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
    }
    finally {
      st.loading = false;
    }
  }

  async function createList(booking_id: string, guests: Guest[]) {
    return await useApi("/guest-lists/manual", {
      method: "POST",
      body: {
        booking_id,
        guests: guests.map(g => ({
          name: g.name,
          date_of_birth: g.date_of_birth,
          city: g.city,
          phone: g.phone,
        })),
      },
    }) as { booking_id: string; preview_id: string; guests: Guest[]; errors: string[] };
  }

  async function updateList(guest_list_id: string, guests: Guest[], _booking_id?: string | number) {
    return await useApi("/guest-lists/modify-list", {
      method: "POST",
      body: {
        guest_list_id,
        guests: guests.map(g => ({
          guest_id: g.id,
          name: g.name,
          date_of_birth: g.date_of_birth,
          city: g.city,
          phone: g.phone,
        })),
      },
    }) as { detail: string; guest_list: GuestList };
  }

  async function deleteList(guest_list_id: string) {
    return await useApi("/guest-lists/delete-list", {
      method: "POST",
      body: { guest_list_id },
    }) as { detail: string };
  }

  async function previewExcel(booking_id: string | number, file: File) {
    const form = new FormData();
    form.append("booking_id", String(booking_id));
    form.append("file", file);
    return await useApi("/guest-lists/preview", {
      method: "POST",
      body: form,
      headers: {},
    }) as {
      booking_id: string;
      preview_id?: string;
      guests: Guest[];
      errors: string[];
      guest_list?: GuestList;
    };
  }

  async function previewManual(booking_id: string | number, guests: Guest[]) {
    return await useApi("/guest-lists/manual", {
      method: "POST",
      body: {
        booking_id: String(booking_id),
        guests: guests.map(g => ({
          name: g.name,
          date_of_birth: g.date_of_birth,
          city: g.city,
          phone: g.phone,
        })),
      },
    }) as {
      booking_id: string;
      preview_id?: string;
      guests: Guest[];
      errors: string[];
      guest_list?: GuestList;
    };
  }

  async function confirmExcel(preview_id: string, booking_id: string | number, guests: Guest[]) {
    return await useApi("/guest-lists/confirm", {
      method: "POST",
      body: {
        preview_id,
        booking_id: String(booking_id),
        guests: guests.map(g => ({
          name: g.name,
          date_of_birth: g.date_of_birth,
          city: g.city,
          phone: g.phone,
        })),
      },
    }) as {
      booking_id: string;
      preview_id: string;
      guests: Guest[];
      errors: string[];
      guest_list?: GuestList;
    };
  }

  async function saveManualForBooking(booking_id: string | number, guests: Guest[]) {
    return await useApi("/guest-lists/manual", {
      method: "POST",
      body: {
        booking_id: String(booking_id),
        guests: guests.map(g => ({
          name: g.name,
          date_of_birth: g.date_of_birth,
          city: g.city,
          phone: g.phone,
        })),
      },
    }) as {
      booking_id: string;
      preview_id: string;
      guests: Guest[];
      errors: string[];
      guest_list?: GuestList;
    };
  }

  async function confirmAdmin(booking_id: string | number, guests: Guest[]) {
    return await useApi("/guest-lists/admin/confirm", {
      method: "POST",
      body: {
        booking_id: String(booking_id),
        guests: guests.map(g => ({
          name: g.name,
          date_of_birth: g.date_of_birth,
          city: g.city,
          phone: g.phone,
        })),
      },
    }) as {
      booking_id: string;
      preview_id?: string;
      guests: Guest[];
      errors: string[];
      guest_list?: GuestList;
    };
  }

  async function deleteAdminGuestList(booking_id: string | number) {
    return await useApi(`/guest-lists/admin/booking/${booking_id}`, {
      method: "DELETE",
    }) as {
      detail: string;
    };
  }

  function hasGuestList(bookingId: string | number): boolean {
    const list = byBookingId[bookingId]?.list;
    if (list && Array.isArray(list.guests) && list.guests.length > 0) {
      return true;
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

  return {
    byBookingId,
    fetchByBooking,
    createList,
    updateList,
    deleteList,
    previewExcel,
    previewManual,
    confirmExcel,
    confirmAdmin,
    deleteAdminGuestList,
    hasGuestList,
    setListForBooking,
    saveManualForBooking,
  };
});
