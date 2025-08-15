<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  dateStr: string;
  modelValue: string | null;
}>();

const emit = defineEmits<{
  (e: "confirm", payload: { category: "Open" | "Limited" | "Closed"; limit?: number }): void;
  (e: "cancel"): void;
}>();

const category = ref<"Open" | "Limited" | "Closed">("Open");
const limit = ref<number>(0);

watch(
  () => props.modelValue,
  () => {
    category.value = "Open";
    limit.value = 0;
  },
);

function onConfirm() {
  emit("confirm", {
    category: category.value,
    ...(category.value === "Limited" ? { limit: limit.value } : {}),
  });
}
</script>

<template>
  <div
    data-theme="light"
    class="bg-white text-gray-900 p-3 rounded shadow space-y-2 min-w-64"
    @click.stop
  >
    <div class="text-sm font-medium mb-1">
      {{ dateStr }}
    </div>
    <select v-model="category" class="select select-bordered w-full">
      <option value="Open">
        Открыто
      </option>
      <option value="Closed">
        Закрыто
      </option>
      <option value="Limited">
        Лимит
      </option>
    </select>

    <div v-if="category === 'Limited'">
      <label class="block text-sm font-medium">Лимит</label>
      <input
        v-model.number="limit"
        type="number"
        min="0"
        class="input input-bordered w-full"
      >
    </div>

    <div class="flex justify-end gap-2 pt-1">
      <button class="btn btn-sm btn-primary" @click="onConfirm">
        Сохранить
      </button>
      <button class="btn btn-sm" @click="$emit('cancel')">
        Отмена
      </button>
    </div>
  </div>
</template>
