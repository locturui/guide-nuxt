<script setup>
const props = defineProps({
  start: Date,
  end: Date,
  left: Number,
  limit: Number,
  bookings: Array,
  selected: { type: Boolean, default: false },
  selectMode: { type: Boolean, default: false },
});

const emits = defineEmits(["selectSlot", "selectBooking"]);
const isHovered = ref(false);

const bookingsWithStatus = computed(() => {
  return (props.bookings || []).map((b) => {
    return {
      ...b,
      severity: getBookingBadgeSeverity(b),
    };
  });
});

function getBookingBadgeSeverity(booking) {
  const status = booking.status;

  if (status === "assigned")
    return "success";
  if (status === "filled")
    return "warning";
  return "info";
}

const auth = useAuthStore();

function onSelectSlot() {
  emits("selectSlot", props.start);
}
function onSelectBooking(b) {
  if (!props.selectMode) {
    emits("selectBooking", b);
  }
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

function isImmediateOnly() {
  const now = new Date(nowTick.value);
  const slot = props.start;
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const slot0 = new Date(slot.getFullYear(), slot.getMonth(), slot.getDate());

  if (slot0.getTime() === today0.getTime()) {
    const cutoff = nextHalfHour(now);
    return slot >= cutoff;
  }

  if (slot0 > today0) {
    const prev = new Date(slot0);
    prev.setDate(prev.getDate() - 1);
    const cutoff = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), 20, 0, 0, 0);
    return now >= cutoff;
  }
  return false;
}

const onlyImmediateAllowed = computed(() => isImmediateOnly());
</script>

<template>
  <div
    class="p-2 sm:p-2.5 flex flex-col justify-between h-28 sm:h-36 cursor-pointer transition-all duration-200 ease-in-out transform overflow-visible rounded-lg relative"
    :class="[
      left <= 0 || isDisabled
        ? 'bg-gray-200 text-gray-500 border border-gray-300 opacity-60 cursor-not-allowed'
        : onlyImmediateAllowed && !isDisabled
          ? 'border-amber-500 border-2 border-dashed bg-amber-50 text-amber-800 hover:bg-amber-100 hover:shadow-md hover:scale-105 hover:z-10'
          : 'bg-white hover:bg-gray-50 hover:shadow-md hover:scale-105 hover:z-10 text-gray-700 border border-gray-100',
      selectMode && (selected || isHovered) ? 'border-green-600 border-2' : '',
    ]"
    @click="() => {
      if (!isDisabled && (left > 0 || auth.role === 'admin')) {
        onSelectSlot();
      }
    }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <div class="relative z-10 flex flex-col flex-1 min-h-0 overflow-visible">
      <div class="text-xs sm:text-sm font-medium">
        {{ left }}/{{ limit }} свободно
      </div>
      <div
        v-if="bookings.length"
        class="flex flex-wrap gap-1 overflow-y-auto overflow-x-visible mt-1 mb-1 px-1 pt-1 pb-0 relative flex-1 min-h-0 items-start content-start"
      >
        <Tag
          v-for="b in bookingsWithStatus"
          :key="b.id"
          :value="`${b.agentName} - ${b.guests}`"
          :severity="b.severity"
          :data-severity="b.severity"
          class="relative text-[10px] sm:text-xs flex-shrink-0 z-20"
          style="transform-origin: center;"
          :class="[
            selectMode ? 'cursor-default' : 'cursor-pointer',
            selectMode ? '' : 'transition-transform duration-200 ease-in-out hover:scale-105 hover:shadow-md',
            b.immediate ? 'border-2 border-dashed border-amber-600' : '',
            b.joint ? 'border-2 border-dotted border-purple-500' : '',
            b.isRadio ? 'border-2 border-solid border-blue-500' : '',
            `booking-badge-${b.severity}`,
          ]"
          @click="selectMode ? undefined : ($event.stopPropagation(), onSelectBooking({
            id: b.id,
            agentId: b.agentId,
            agentName: b.agentName,
            guests: b.guests,
            date: props.start.toISOString().split('T')[0],
            time: formatTime(props.start),
          }))"
        />
      </div>
      <div class="text-[10px] sm:text-xs text-gray-600 mt-auto">
        {{ formatTime(start) }} - {{ formatTime(end) }}
      </div>
    </div>
    <div
      v-if="selectMode && (selected || isHovered)"
      class="absolute inset-0 bg-green-500/20 rounded-lg pointer-events-none z-20"
    />
  </div>
</template>

<style scoped>
:deep(.p-tag) {
  overflow: visible !important;
}
</style>
