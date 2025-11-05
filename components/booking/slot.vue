<script setup>
import { useGuestListsStore } from "@/stores/guest-lists";

const props = defineProps({
  start: Date,
  end: Date,
  left: Number,
  limit: Number,
  bookings: Array,
});

const emits = defineEmits(["selectSlot", "selectBooking"]);
const gl = useGuestListsStore();

const bookingsWithStatus = computed(() => {
  return (props.bookings || []).map(b => ({
    ...b,
    hasGuestList: gl.hasGuestList && gl.hasGuestList(b.id),
  }));
});

function getBookingBadgeClass(booking) {
  if (booking.status === "assigned") {
    return "badge-success";
  }
  if (booking.hasGuestList) {
    return "badge-warning";
  }
  return "badge-primary";
}

const auth = useAuthStore();

function onSelectSlot() {
  emits("selectSlot", props.start);
}
function onSelectBooking(b) {
  emits("selectBooking", b);
}
function formatTime(d) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function nextHalfHour(d) {
  const t = new Date(d);
  t.setSeconds(0, 0);
  const m = t.getMinutes();
  if (m < 30) {
    t.setMinutes(30);
  }
  else {
    t.setMinutes(0);
    t.setHours(t.getHours() + 1);
  }
  return t;
}
const nowTick = ref(Date.now());
let _timer;
onMounted(() => {
  _timer = setInterval(() => {
    nowTick.value = Date.now();
  }, 30_000);
});
onBeforeUnmount(() => {
  clearInterval(_timer);
});

const isDisabled = computed(() => {
  const now = new Date(nowTick.value);
  const slot = props.start;

  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const slot0 = new Date(slot.getFullYear(), slot.getMonth(), slot.getDate());

  if (slot0 < today0) {
    return true;
  }
  if (slot0 > today0) {
    return false;
  }

  const cutoff = nextHalfHour(now);
  return slot < cutoff;
});
</script>

<template>
  <div
    class="border p-2 sm:p-2.5 flex flex-col justify-between h-28 sm:h-36 cursor-pointer transition-all duration-200 ease-in-out transform overflow-x-visible"
    :class="[
      left <= 0 || isDisabled
        ? 'border-gray-100 bg-gray-200 text-gray-600'
        : 'border-gray-100 hover:bg-gray-100 hover:shadow-md hover:scale-105 hover:z-10 text-gray-600',
      (new Date(start).toDateString() === new Date().toDateString()) && !isDisabled
        ? 'bg-amber-50'
        : '',
    ]"
    @click="() => {
      if (!isDisabled && (left > 0 || auth.role === 'admin')) onSelectSlot();
    }"
  >
    <div class="text-xs sm:text-sm font-medium">
      {{ left }}/{{ limit }} свободно
    </div>
    <div v-if="bookings.length" class="flex flex-wrap gap-1 flex-1 overflow-auto overflow-x-visible mt-1 mb-1 pr-1 relative">
      <span
        v-for="b in bookingsWithStatus"
        :key="b.id"
        class="badge px-1.5 py-0.5 text-[10px] sm:text-xs cursor-pointer transition-transform duration-200 ease-in-out hover:scale-105 hover:shadow-md relative hover:z-10"
        :class="[
          getBookingBadgeClass(b),
          b.immediate ? 'border-2 border-dashed border-amber-600 bg-amber-50 text-amber-800' : '',
        ]"
        @click.stop="onSelectBooking({
          id: b.id,
          agentId: b.agentId,
          agentName: b.agentName,
          guests: b.guests,
          date: props.start.toISOString().split('T')[0],
          time: formatTime(props.start),
        })"
      >
        {{ b.agentName }} - {{ b.guests }}
      </span>
    </div>
    <div class="text-[10px] sm:text-xs text-gray-600">
      {{ formatTime(start) }} - {{ formatTime(end) }}
    </div>
  </div>
</template>
