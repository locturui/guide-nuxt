<script setup lang="ts">
const _ = defineProps<{
  days: Date[];
  times: string[];
  role: "admin" | "agency";
  ghostHeaders?: boolean;
}>();

const emit = defineEmits<{
  (e: "toggleDay", d: Date): void;
  (e: "selectSlot", payload: { date: string; time: string }): void;
  (e: "selectBooking", payload: any): void;
}>();
</script>

<template>
  <div
    class="grid w-full gap-0"
    style="grid-template-columns:40px repeat(7, minmax(0, 1fr));"
  >
    <div :class="ghostHeaders ? 'invisible pointer-events-none' : ''" />

    <div
      v-for="d in days"
      :key="d.toISOString()"
      :class="ghostHeaders ? 'invisible pointer-events-none' : ''"
    >
      <DayHeader
        :date="d"
        :role="role"
        @toggle="emit('toggleDay', d)"
      >
        <div
          v-if="!ghostHeaders"
          class="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[1000]"
          style="pointer-events:auto"
        >
          <slot name="day-dropdown" :date="d" />
        </div>
      </DayHeader>
    </div>

    <template v-for="time in times" :key="time">
      <div class="text-right pr-2 text-xs text-gray-500">
        {{ time }}
      </div>
      <div
        v-for="d in days"
        :key="d.toISOString() + time"
        class="relative"
      >
        <BookingSlotCell
          :date="d"
          :time="time"
          :role="role"
          @select-slot="emit('selectSlot', $event)"
          @select-booking="emit('selectBooking', $event)"
        />
      </div>
    </template>
  </div>
</template>
