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
</script>

<template>
  <div
    class="border p-2 flex flex-col justify-between h-36"
    :class="[
      left <= 0
        ? 'border-gray-200 bg-gray-200 text-gray-600'
        : 'border-gray-200 hover:bg-gray-100 text-gray-600',
    ]"
    @click="() => {
      if (left > 0 || auth.role === 'admin') onSelectSlot();
    }"
  >
    <div class="text-sm font-medium">
      {{ left }}/{{ limit }} left
    </div>
    <div v-if="bookings.length" class="flex flex-col flex-1 overflow-auto mt-0.5 mb-0.5">
      <span
        v-for="b in bookings"
        :key="b.id"
        class="badge badge-primary text-xs mb-1 cursor-pointer"
        @click.stop="onSelectBooking(b)"
      >
        {{ b.agentName }} - {{ b.guests }}
      </span>
    </div>
    <div class="text-xs text-gray-600">
      {{ formatTime(start) }} - {{ formatTime(end) }}
    </div>
  </div>
</template>
