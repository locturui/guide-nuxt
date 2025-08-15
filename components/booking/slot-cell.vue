<script setup>
import { useScheduleStore } from "@/stores/schedule";
import { formattedDate, parseSlotDate } from "@/utils/date";

const props = defineProps({
  date: { type: Date, required: true },
  time: { type: String, required: true },
  role: { type: String, required: true },
});
defineEmits(["selectSlot", "selectBooking"]);

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
    guests: b.people_count,
    date: dateStr.value,
    time: props.time,
  })),
);

const selected = computed(() => !!s.selectedSlots[`${dateStr.value}|${props.time}`]);
function toggle() {
  s.toggleSelect(dateStr.value, props.time);
}
</script>

<template>
  <label
    v-if="role === 'admin'"
    class="absolute top-1 right-1 z-50"
    style="pointer-events:auto"
  >
    <input
      type="checkbox"
      class="checkbox checkbox-primary checkbox-sm"
      :checked="selected"
      @change="toggle"
    >
  </label>

  <BookingSlot
    :start="start"
    :end="end"
    :left="left"
    :limit="limit"
    :bookings="bookings"
    @select-slot="() => $emit('selectSlot', { date: dateStr, time })"
    @select-booking="(b) => $emit('selectBooking', b)"
  />
</template>
