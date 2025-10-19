import { formattedDate, startOfWeek } from "@/utils/date";

export type BookingDTO = { id: number; people_count: number; agency_id?: number; agency_name?: string; status?: string; precise_time?: string };
export type SlotDTO = { time: string; limit: number; remaining: number; bookings?: BookingDTO[] };
export type DayDTO = { date: string; timeslots: SlotDTO[] };

export const useScheduleStore = defineStore("schedule", () => {
  const weekStart = ref(startOfWeek(new Date()));
  const timeSlots = ref<DayDTO[]>([]);
  const extraSlotData = reactive<Record<string, { limit: number; remaining: number }>>({});
  const selectedSlots = reactive<Record<string, boolean>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);

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
        })),
      ),
    ));

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
      const res = await useApi(role === "admin"
        ? `/week/admin?date=${dateStr}`
        : `/week/agency?date=${dateStr}`);
      timeSlots.value = res as DayDTO[];
    }
    catch (e: any) {
      error.value = e?.message || "Failed to fetch week";
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
      const res = await useApi("/days/get-slot-data", { method: "POST", body: { date, time } });
      const limit = Number((res as any)?.limit ?? 0);
      const remaining = Number((res as any)?.remaining ?? Math.max(0, limit - Number((res as any)?.booked ?? (res as any)?.bookings_count ?? 0)));
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

  async function book(date: string, time: string, people: number) {
    await useApi("/days/book", { method: "POST", body: { date, time, people_count: people } });
    await fetchWeek();
  }

  async function modifyBooking(bookingId: string, people: number, preciseTime?: string) {
    const response = await useApi("/days/modify-booking", { method: "POST", body: { booking_id: bookingId, people_count: people, precise_time: preciseTime } });
    await fetchWeek();
    return response;
  }

  async function adminModifyBooking(payload: { bookingId: string; date: string; time: string; people: number; preciseTime?: string }) {
    const response = await useApi("/days/admin/modify-booking", { method: "POST", body: {
      booking_id: payload.bookingId,
      date: payload.date,
      time: payload.time,
      people_count: payload.people,
      precise_time: payload.preciseTime,
    } });
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
    loading,
    error,
    slotMap,
    allTimes,
    allBookings,
    selectedPairs,
    remainingCapacity,
    setWeekStart,
    fetchWeek,
    fetchSlotData,
    toggleSelect,
    clearSelection,
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
