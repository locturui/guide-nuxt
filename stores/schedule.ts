import { formattedDate, startOfWeek } from "@/utils/date";

export type BookingStatus = "booked" | "filled" | "assigned";

export type BookingType = "regular" | "joint" | "immediate";

export type BookingDTO = {
  id: string | number;
  people_count: number;
  agency_id?: number;
  agency_name?: string;
  status: BookingStatus;
  precise_time?: string;
  booking_type?: BookingType;
  immediate?: boolean;
  joint?: boolean;
  is_joint?: boolean;
  is_radio?: boolean;
  curator_name?: string;
  driver_name?: string;
};

export type SlotDTO = {
  time: string;
  limit: number;
  remaining: number;
  limited?: boolean;
  bookings?: BookingDTO[];
};

export type DayDTO = {
  date: string;
  category?: string;
  limit?: number;
  timeslots: SlotDTO[];
};

export const useScheduleStore = defineStore("schedule", () => {
  const weekStart = ref(startOfWeek(new Date()));
  const timeSlots = ref<DayDTO[]>([]);
  const extraSlotData = reactive<Record<string, { limit: number; remaining: number }>>({});
  const selectedSlots = reactive<Record<string, boolean>>({});
  const selectMode = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const targetDate = ref<string | null>(null);

  function extractErrorMessage(err: unknown, fallback: string) {
    const e = err as { data?: { detail?: string }; message?: string };
    return e?.data?.detail || e?.message || fallback;
  }

  async function downloadDaySummary(dateStr: string): Promise<Blob> {
    return await useApi<Blob>("/days/summary", {
      method: "POST",
      body: { date: dateStr },
      responseType: "blob",
    });
  }

  async function fetchBookingInfo(bookingId: string): Promise<{ date: string; time: string }> {
    return await useApi<{ date: string; time: string }>("/days/get-booking-info", {
      method: "POST",
      body: { booking_id: bookingId },
    });
  }

  const slotMap = computed(() => {
    const map: Record<string, Record<string, SlotDTO>> = {};
    for (const day of timeSlots.value) {
      map[day.date] = day.timeslots.reduce((acc, slot) => {
        acc[slot.time] = slot;
        return acc;
      }, {} as Record<string, SlotDTO>);
    }
    return map;
  });

  const allTimes = computed(() => {
    const set = new Set<string>();
    timeSlots.value.forEach(d => d.timeslots.forEach(t => set.add(t.time)));
    return Array.from(set).sort();
  });

  const allBookings = computed(() =>
    timeSlots.value.flatMap(day =>
      day.timeslots.flatMap(slot =>
        (slot.bookings || []).map(b => ({
          id: b.id,
          date: day.date,
          time: slot.time,
          guests: b.people_count,
          agentId: b.agency_id,
          agentName: b.agency_name,
          status: b.status,
          preciseTime: b.precise_time,
          immediate: Boolean(b.immediate) || b.booking_type === "immediate",
          joint: b.booking_type === "joint" || Boolean(b.joint) || Boolean(b.is_joint),
          isRadio: Boolean(b.is_radio),
          curatorName: b.curator_name,
          driverName: b.driver_name,
        })),
      ),
    ),
  );

  const selectedPairs = computed(() =>
    Object.entries(selectedSlots)
      .filter(([, v]) => v)
      .map(([k]) => k.split("|") as [string, string]),
  );

  function remainingCapacity(dateStr: string, time: string) {
    const key = `${dateStr}|${time}`;
    if (extraSlotData[key])
      return extraSlotData[key].remaining ?? 0;
    return slotMap.value[dateStr]?.[time]?.remaining || 0;
  }

  async function setWeekStart(d: Date) {
    weekStart.value = startOfWeek(d);
    await fetchWeek();
  }

  async function fetchWeek() {
    loading.value = true;
    error.value = null;
    const dateStr = formattedDate(weekStart.value);
    try {
      const role = useAuthStore().role;
      const res = await useApi<DayDTO[]>(role === "admin"
        ? `/week/admin?date=${dateStr}`
        : `/week/agency?date=${dateStr}`);
      timeSlots.value = res;
    }
    catch (err: unknown) {
      error.value = extractErrorMessage(err, "Failed to fetch week");
    }
    finally {
      loading.value = false;
    }
  }

  async function fetchSlotData(date: string, time: string) {
    const inWeek = slotMap.value[date]?.[time];
    const key = `${date}|${time}`;
    if (inWeek || extraSlotData[key])
      return;
    try {
      const res = await useApi<{ limit?: number; remaining?: number; booked?: number; bookings_count?: number }>("/days/get-slot-data", { method: "POST", body: { date, time } });
      const limit = Number(res?.limit ?? 0);
      const remaining = Number(res?.remaining ?? Math.max(0, limit - Number(res?.booked ?? res?.bookings_count ?? 0)));
      extraSlotData[key] = { limit, remaining };
    }
    catch {
      extraSlotData[key] = { limit: 0, remaining: 0 };
    }
  }

  function toggleSelect(dateStr: string, time: string) {
    const key = `${dateStr}|${time}`;
    selectedSlots[key] = !selectedSlots[key];
  }
  function clearSelection() {
    Object.keys(selectedSlots).forEach(k => delete selectedSlots[k]);
    selectMode.value = false;
  }
  function setSelectMode(enabled: boolean) {
    selectMode.value = enabled;
    if (!enabled) {
      clearSelection();
    }
  }

  async function setDayCategory(dateStr: string, payload: { category: string; limit?: number }) {
    await useApi("/days/set-day-category", { method: "POST", body: { date: dateStr, ...payload } });
    await fetchWeek();
  }

  async function setTimeslotLimit(dateStr: string, time: string, limit: number) {
    await useApi("/days/set-timeslot-limit", { method: "POST", body: { date: dateStr, time_str: time, limit } });
    const day = timeSlots.value.find(d => d.date === dateStr);
    const slot = day?.timeslots.find(s => s.time === time);
    if (slot) {
      const booked = (slot.bookings || []).reduce((s, b) => s + b.people_count, 0);
      slot.limit = limit;
      slot.remaining = Math.max(0, limit - booked);
    }
  }

  async function bulkSetTimeslotLimits(limit: number, pairs: Array<[string, string]>) {
    await useApi("/days/admin/update-timeslot-limits", { method: "POST", body: { limit, timeslots: pairs } });
    await fetchWeek();
  }

  async function book(date: string, time: string, people: number, isJoint: boolean = false, isRadio: boolean = false, curatorName?: string, driverName?: string) {
    const body: Record<string, unknown> = { date, time, people_count: people, is_joint: isJoint, is_radio: isRadio };
    if (curatorName !== undefined) {
      body.curator_name = curatorName;
    }
    if (driverName !== undefined) {
      body.driver_name = driverName;
    }
    await useApi("/days/book", { method: "POST", body });
    const bookingDate = new Date(date);
    const bookingWeekStart = startOfWeek(bookingDate);

    weekStart.value = bookingWeekStart;
    targetDate.value = date;
    await fetchWeek();
  }

  async function modifyBooking(bookingId: string, people: number, preciseTime?: string, isRadio?: boolean, curatorName?: string, driverName?: string) {
    const body: Record<string, unknown> = { booking_id: bookingId, people_count: people, precise_time: preciseTime };
    if (isRadio !== undefined) {
      body.is_radio = isRadio;
    }
    if (curatorName !== undefined) {
      body.curator_name = curatorName;
    }
    if (driverName !== undefined) {
      body.driver_name = driverName;
    }
    const response = await useApi("/days/modify-booking", { method: "POST", body });
    await fetchWeek();
    return response;
  }

  async function adminModifyBooking(payload: { bookingId: string; date: string; time: string; people: number; preciseTime?: string; isRadio?: boolean; curatorName?: string; driverName?: string }) {
    const body: Record<string, unknown> = {
      booking_id: payload.bookingId,
      date: payload.date,
      time: payload.time,
      people_count: payload.people,
      precise_time: payload.preciseTime,
    };
    if (payload.isRadio !== undefined) {
      body.is_radio = payload.isRadio;
    }
    if (payload.curatorName !== undefined) {
      body.curator_name = payload.curatorName;
    }
    if (payload.driverName !== undefined) {
      body.driver_name = payload.driverName;
    }
    const response = await useApi("/days/admin/modify-booking", { method: "POST", body });
    await fetchWeek();
    return response;
  }

  async function cancelBooking(bookingId: string) {
    await useApi("/days/cancel-booking", { method: "POST", body: { booking_id: bookingId } });
    await fetchWeek();
  }

  async function adminCancelBooking(bookingId: string) {
    await useApi("/days/admin/cancel-booking", { method: "POST", body: { booking_id: bookingId } });
    await fetchWeek();
  }

  return {
    weekStart,
    timeSlots,
    extraSlotData,
    selectedSlots,
    selectMode,
    loading,
    error,
    targetDate,
    slotMap,
    allTimes,
    allBookings,
    selectedPairs,
    remainingCapacity,
    setWeekStart,
    fetchWeek,
    fetchSlotData,
    downloadDaySummary,
    fetchBookingInfo,
    toggleSelect,
    clearSelection,
    setSelectMode,
    setDayCategory,
    setTimeslotLimit,
    bulkSetTimeslotLimits,
    book,
    modifyBooking,
    adminModifyBooking,
    cancelBooking,
    adminCancelBooking,
  };
});
