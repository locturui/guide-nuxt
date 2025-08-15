<script setup lang="ts">
import { ref, watch } from "vue";

import { useScheduleStore } from "@/stores/schedule";
import { isHalfHour, roundToHalfHour } from "~/utils/time";

const props = defineProps<{ date: string; time: string; initialLimit?: number }>();
const emit = defineEmits(["close"]);

const s = useScheduleStore();
const limitRef = ref<number>(props.initialLimit ?? 0);
const formTime = ref<string>(props.time);

watch(formTime, (v) => {
  if (!v)
    return;
  if (!isHalfHour(v))
    formTime.value = roundToHalfHour(v);
});

async function save() {
  await s.setTimeslotLimit(props.date, formTime.value, limitRef.value);
  emit("close");
}
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center z-60">
    <div class="bg-white p-6 rounded-lg w-80">
      <h3 class="font-bold mb-2">
        Задать лимит гостей для слота
      </h3>

      <label>Дата</label>
      <input
        type="date"
        :value="date"
        disabled
        class="input"
      >

      <label>Время</label>
      <input
        v-model="formTime"
        type="time"
        step="1800"
        class="input"
        disabled
      >

      <label>Лимит гостей</label>
      <input
        v-model.number="limitRef"
        type="number"
        class="input"
      >

      <div class="flex justify-end space-x-2 mt-4">
        <button class="btn btn-sm btn-primary" @click="save">
          Сохранить
        </button>
        <button class="btn btn-sm" @click="$emit('close')">
          Отмена
        </button>
      </div>
    </div>
  </div>
</template>
