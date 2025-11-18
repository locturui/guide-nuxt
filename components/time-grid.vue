<script setup lang="ts">
defineProps<{
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
    class="grid w-full gap-2"
    style="grid-template-columns:32px repeat(7, minmax(120px, 1fr));"
  >
    <template v-for="time in times" :key="time">
      <div class="text-right pr-2 text-[10px] sm:text-xs text-gray-500 select-none">
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
