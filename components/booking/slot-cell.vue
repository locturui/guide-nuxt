<script setup>
import { useScheduleStore } from "@/stores/schedule";
import { formattedDate, parseSlotDate } from "@/utils/date";

const props = defineProps({
  date: { type: Date, required: true },
  time: { type: String, required: true },
  role: { type: String, required: true },
});
const emit = defineEmits(["selectSlot", "selectBooking"]);

const s = useScheduleStore();

const dateStr = computed(() => formattedDate(props.date));
const start = computed(() => parseSlotDate(props.date, props.time));
const end = computed(() => new Date(start.value.getTime() + 30 * 60000));

const cell = computed(() => s.slotMap[dateStr.value]?.[props.time]);
const left = computed(() => s.remainingCapacity(dateStr.value, props.time));
const limit = computed(() => cell.value?.limit || 0);
const bookings = computed(() =>
  (cell.value?.bookings || []).map(b => ({
    id: b.id,
    agentName: b.agency_name,
    agentId: b.agency_id,
    guests: b.people_count,
    date: dateStr.value,
    time: props.time,
    status: b.status,
    immediate: b.booking_type === "immediate",
  })),
);

const selected = computed(() => !!s.selectedSlots[`${dateStr.value}|${props.time}`]);

function handleSlotClick() {
  if (props.role === "admin" && s.selectMode) {
    s.toggleSelect(dateStr.value, props.time);
  }
  else {
    emit("selectSlot", { date: dateStr.value, time: props.time });
  }
}
</script>

<template>
  <BookingSlot
    :start="start"
    :end="end"
    :left="left"
    :limit="limit"
    :bookings="bookings"
    :selected="selected"
    :select-mode="role === 'admin' && s.selectMode"
    @select-slot="handleSlotClick"
    @select-booking="(b) => emit('selectBooking', b)"
  />
</template>
