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
  <Card
    class="min-w-[14rem] max-w-[90vw]"
    @click.stop
  >
    <template #content>
      <div class="space-y-3">
        <Button
          label="📄 Скачать сводку"
          icon="pi pi-download"
          size="small"
          class="w-full"
          :loading="downloadPending"
          :disabled="downloadPending"
          @click="onDownloadSummary"
        />

        <Message
          v-if="downloadError"
          severity="error"
          class="text-xs"
        >
          {{ downloadError }}
        </Message>

        <Divider />

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-surface-700">Категория дня</label>
          <Select
            v-model="category"
            :options="[
              { label: 'Открыто', value: 'Open' },
              { label: 'Закрыто', value: 'Closed' },
              { label: 'Лимит', value: 'Limited' },
            ]"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>

        <div v-if="category === 'Limited'" class="flex flex-col gap-2">
          <label class="text-sm font-medium text-surface-700">Лимит</label>
          <InputNumber
            v-model="limit"
            :min="0"
            class="w-full"
          />
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <Button
            label="Сохранить"
            icon="pi pi-check"
            size="small"
            @click="onConfirm"
          />
          <Button
            label="Отмена"
            icon="pi pi-times"
            outlined
            severity="secondary"
            size="small"
            @click="$emit('cancel')"
          />
        </div>
      </div>
    </template>
  </Card>
</template>
