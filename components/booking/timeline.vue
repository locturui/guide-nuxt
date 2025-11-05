<script setup lang="ts">
import { formattedDate } from "~/utils/date";

const props = defineProps<{
  days: Date[];
  times: string[];
  role: "admin" | "agency";
}>();

const emit = defineEmits<{
  (e: "toggleDay", d: Date): void;
  (e: "selectSlot", payload: { date: string; time: string }): void;
  (e: "selectBooking", payload: any): void;
}>();

const activeIdx = ref(0);

const activeDay = computed(() => props.days[activeIdx.value] || props.days[0]);
const _activeDateStr = computed(() => formattedDate(activeDay.value));

function prevDay() {
  if (activeIdx.value > 0)
    activeIdx.value -= 1;
}
function nextDay() {
  if (activeIdx.value < props.days.length - 1)
    activeIdx.value += 1;
}

let touchStartX = 0;
let touchStartY = 0;
function onTouchStart(e: TouchEvent) {
  const t = e.changedTouches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}
function onTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0)
      nextDay();
    else
      prevDay();
  }
}
</script>

<template>
  <div class="w-full max-w-screen-md mx-auto">
    <div class="flex items-center justify-between mb-3 px-1">
      <button
        class="btn btn-xs sm:btn-sm"
        :disabled="activeIdx === 0"
        @click="prevDay"
      >
        ←
      </button>
      <DayHeader
        :date="activeDay"
        :role="role"
        @toggle="emit('toggleDay', activeDay)"
      >
        <template #default>
          <span />
        </template>
      </DayHeader>
      <button
        class="btn btn-xs sm:btn-sm"
        :disabled="activeIdx === days.length - 1"
        @click="nextDay"
      >
        →
      </button>
    </div>

    <div
      class="border rounded-lg overflow-hidden"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <div class="divide-y">
        <div
          v-for="t in times"
          :key="t"
          class="grid grid-cols-[64px_1fr] items-stretch"
        >
          <div class="text-right pr-2 py-3 text-xs text-gray-500 select-none">
            {{ t }}
          </div>
          <div class="relative">
            <BookingSlotCell
              :date="activeDay"
              :time="t"
              :role="role"
              @select-slot="(p: { date: string; time: string }) => emit('selectSlot', p)"
              @select-booking="(p: any) => emit('selectBooking', p)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
