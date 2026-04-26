<script setup lang="ts">
import { formattedDate } from "@/utils/date";

const props = defineProps<{
  days: Date[];
  times: string[];
  role: "admin" | "agency";
}>();

const emit = defineEmits<{
  (e: "toggleDay", d: Date): void;
  (e: "selectSlot", payload: { date: string; time: string }): void;
  (e: "selectBooking", payload: unknown): void;
}>();

const s = useScheduleStore();
const activeDateStr = ref<string | null>(null);

function initializeActiveDate() {
  if (!activeDateStr.value && props.days.length > 0) {
    if (s.targetDate) {
      const targetIdx = props.days.findIndex(d => formattedDate(d) === s.targetDate);
      if (targetIdx >= 0) {
        activeDateStr.value = s.targetDate;
        s.targetDate = null;
        return;
      }
    }

    const today = new Date();
    const todayStr = formattedDate(today);
    const todayIdx = props.days.findIndex(d => formattedDate(d) === todayStr);
    if (todayIdx >= 0) {
      activeDateStr.value = todayStr;
    }
    else {
      activeDateStr.value = formattedDate(props.days[0]);
    }
  }
}

watch(() => props.days, () => {
  if (props.days.length === 0) {
    return;
  }
  if (s.targetDate) {
    const targetIdx = props.days.findIndex(d => formattedDate(d) === s.targetDate);
    if (targetIdx >= 0) {
      activeDateStr.value = s.targetDate;
      s.targetDate = null;
      return;
    }
  }

  if (!activeDateStr.value) {
    initializeActiveDate();
  }
  else {
    const idx = props.days.findIndex(d => formattedDate(d) === activeDateStr.value);
    if (idx < 0) {
      activeDateStr.value = formattedDate(props.days[0]);
    }
  }
}, { immediate: true });

watch(() => s.targetDate, (target) => {
  if (target && props.days.length > 0) {
    const targetIdx = props.days.findIndex(d => formattedDate(d) === target);
    if (targetIdx >= 0) {
      activeDateStr.value = target;
      s.targetDate = null;
    }
  }
}, { immediate: true });

const activeIdx = computed(() => {
  if (activeDateStr.value && props.days.length > 0) {
    const idx = props.days.findIndex(d => formattedDate(d) === activeDateStr.value);
    if (idx >= 0) {
      return idx;
    }
  }
  return 0;
});

const activeDay = computed(() => props.days[activeIdx.value] || props.days[0]);
const _activeDateStr = computed(() => formattedDate(activeDay.value));

function prevDay() {
  if (activeIdx.value > 0) {
    const prevDate = props.days[activeIdx.value - 1];
    if (prevDate) {
      s.targetDate = null;
      activeDateStr.value = formattedDate(prevDate);
    }
  }
}
function nextDay() {
  if (activeIdx.value < props.days.length - 1) {
    const nextDate = props.days[activeIdx.value + 1];
    if (nextDate) {
      s.targetDate = null;
      activeDateStr.value = formattedDate(nextDate);
    }
  }
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
    <div class="flex items-center justify-between mb-3 px-1 gap-2">
      <Button
        icon="pi pi-chevron-left"
        outlined
        size="small"
        :disabled="activeIdx === 0"
        @click="prevDay"
      />
      <DayHeader
        :date="activeDay"
        :role="role"
        @toggle="emit('toggleDay', activeDay)"
      >
        <template #default>
          <span />
        </template>
      </DayHeader>
      <Button
        icon="pi pi-chevron-right"
        outlined
        size="small"
        :disabled="activeIdx === days.length - 1"
        @click="nextDay"
      />
    </div>

    <Card>
      <template #content>
        <div
          class="overflow-visible"
          @touchstart.passive="onTouchStart"
          @touchend.passive="onTouchEnd"
        >
          <div class="divide-y divide-surface-200">
            <div
              v-for="t in times"
              :key="t"
              class="grid grid-cols-[64px_1fr] items-stretch"
            >
              <div class="text-right pr-2 py-3 text-xs text-surface-500 select-none">
                {{ t }}
              </div>
              <div class="relative overflow-visible">
                <BookingSlotCell
                  :date="activeDay"
                  :time="t"
                  :role="role"
                  @select-slot="(p: { date: string; time: string }) => emit('selectSlot', p)"
                  @select-booking="(p: unknown) => emit('selectBooking', p)"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
:deep(.p-card-body),
:deep(.p-card-content) {
  overflow: visible !important;
}
</style>
