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
const downloadPending = ref(false);
const downloadError = ref("");

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

async function onDownloadSummary() {
  if (downloadPending.value)
    return;

  downloadPending.value = true;
  downloadError.value = "";
  try {
    const blob = await useApi<Blob>("/days/summary", {
      method: "POST",
      body: { date: props.dateStr },
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `summary_${props.dateStr}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
  catch (e: any) {
    console.error("Failed to download summary:", e);
    downloadError.value = e?.data?.detail || e?.message || "Не удалось скачать сводку";
  }
  finally {
    downloadPending.value = false;
  }
}
</script>

<template>
  <div
    data-theme="light"
    class="bg-white text-gray-900 p-3 rounded shadow space-y-2 min-w-[14rem] max-w-[90vw]"
    @click.stop
  >
    <button
      class="btn btn-sm btn-info w-full"
      :disabled="downloadPending"
      @click="onDownloadSummary"
    >
      <span v-if="downloadPending" class="loading loading-dots loading-sm" />
      <span v-else>📄 Скачать сводку</span>
    </button>

    <div v-if="downloadError" class="text-red-600 text-xs">
      ⚠ {{ downloadError }}
    </div>

    <div class="divider my-2" />

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
      <button class="btn btn-xs sm:btn-sm btn-primary" @click="onConfirm">
        Сохранить
      </button>
      <button class="btn btn-xs sm:btn-sm" @click="$emit('cancel')">
        Отмена
      </button>
    </div>
  </div>
</template>
