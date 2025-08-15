<script setup>
import { useScheduleStore } from "@/stores/schedule";

const emit = defineEmits(["open"]);

const s = useScheduleStore();
const count = computed(() => s.selectedPairs.length);
function clear() {
  s.clearSelection();
}
</script>

<template>
  <div
    v-if="count > 0"
    class="fixed bottom-4 right-4 z-50 flex justify-center items-center gap-2 p-3 bg-white shadow-lg rounded-lg"
  >
    <span class="badge badge-primary">{{ count }} выбрано</span>
    <button class="btn btn-sm btn-primary" @click="emit('open')">
      Редактировать выбранные
    </button>
    <button class="btn btn-sm" @click="clear">
      Отмена
    </button>
  </div>
</template>
