<script setup>
const props = defineProps({
  start: Date,
  end: Date,
  left: Number,
  limit: Number,
  bookings: Array,
});

const emits = defineEmits(["selectSlot", "selectBooking"]);

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
  if (auth.role === "admin") {
    return false;
  }

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
    class="border border-gray-100 p-2 flex flex-col justify-between h-36 cursor-pointer transition-all duration-200 ease-in-out transform overflow-x-visible"
    :class="[
      left <= 0 || isDisabled
        ? 'border-gray-100 bg-gray-200 text-gray-600'
        : 'border-gray-100 hover:bg-gray-100 hover:shadow-md hover:scale-105 hover:z-10 text-gray-600',
    ]"
    @click="() => {
      if (!isDisabled && (left > 0 || auth.role === 'admin')) onSelectSlot();
    }"
  >
    <div class="text-sm font-medium">
      {{ left }}/{{ limit }} свободно
    </div>
    <div v-if="bookings.length" class="flex flex-wrap gap-1 flex-1 overflow-auto overflow-x-visible mt-1 mb-1 pr-1 relative">
      <span
        v-for="b in bookings"
        :key="b.id"
        class="badge p-1 badge-primary text-xs cursor-pointer transition-transform duration-200 ease-in-out hover:scale-105 hover:shadow-md relative hover:z-10"
        @click.stop="onSelectBooking({
          id: b.id,
          agentName: b.agentName,
          guests: b.guests,
          date: props.start.toISOString().split('T')[0],
          time: formatTime(props.start),
        })"
      >
        {{ b.agentName }} - {{ b.guests }}
      </span>
    </div>
    <div class="text-xs text-gray-600">
      {{ formatTime(start) }} - {{ formatTime(end) }}
    </div>
  </div>
</template>
