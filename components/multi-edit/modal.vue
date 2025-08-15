<script setup>
import { useScheduleStore } from "@/stores/schedule";

const props = defineProps({ pairs: { type: Array, required: true } });
const emit = defineEmits(["close"]);
const s = useScheduleStore();

const limitRef = ref(0);

async function save() {
  await s.bulkSetTimeslotLimits(limitRef.value, props.pairs);
  emit("close");
}
</script>

<template>
  <div class="fixed inset-0 bg-opacity-50 z-60 flex items-center justify-center">
    <div class="bg-white p-6 rounded-lg w-96">
      <h3 class="font-bold mb-4">
        Редактировать несколько слотов
      </h3>

      <ul class="mb-4 list-disc pl-5 text-sm">
        <li v-for="([d, t], i) in pairs" :key="d + t + i">
          {{ d }} {{ t }}
        </li>
      </ul>

      <label class="block mb-1 font-medium">Новый лимит гостей</label>
      <input
        v-model.number="limitRef"
        type="number"
        class="input w-full mb-1"
        min="0"
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
