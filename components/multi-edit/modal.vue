<script setup>
import { useScheduleStore } from "@/stores/schedule";

const props = defineProps({ pairs: { type: Array, required: true } });
const emit = defineEmits(["close"]);
const s = useScheduleStore();

const limitRef = ref(0);

onMounted(() => {
  document.body.style.overflow = "hidden";
});

onUnmounted(() => {
  document.body.style.overflow = "";
});

async function save() {
  await s.bulkSetTimeslotLimits(limitRef.value, props.pairs);
  emit("close");
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 z-60 flex items-center justify-center" @click="$emit('close')">
    <div class="bg-white p-6 rounded-lg w-96 max-h-[80vh] flex flex-col relative" @click.stop>
      <button
        class="absolute top-2 right-2 btn btn-sm btn-circle btn-ghost"
        @click="$emit('close')"
      >
        ✕
      </button>
      <h3 class="font-bold mb-4">
        Редактировать несколько слотов
      </h3>

      <div class="flex-1 overflow-y-auto mb-4">
        <ul class="list-disc pl-5 text-sm">
          <li v-for="([d, t], i) in pairs" :key="d + t + i">
            {{ d }} {{ t }}
          </li>
        </ul>
      </div>

      <div class="flex-shrink-0">
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
  </div>
</template>
