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
  <div class="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4" @click="$emit('close')">
    <Card
      class="w-full max-w-md max-h-[80vh] flex flex-col"
      @click.stop
    >
      <template #header>
        <div class="flex items-center justify-between p-4 pb-2">
          <h3 class="text-lg font-semibold m-0">
            Редактировать несколько слотов
          </h3>
          <Button
            icon="pi pi-times"
            text
            rounded
            size="small"
            @click="$emit('close')"
          />
        </div>
      </template>
      <template #content>
        <div class="flex-1 overflow-y-auto mb-4">
          <ul class="list-disc pl-5 text-sm text-surface-700">
            <li v-for="([d, t], i) in pairs" :key="d + t + i">
              {{ d }} {{ t }}
            </li>
          </ul>
        </div>

        <div class="flex-shrink-0">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-surface-700">Новый лимит гостей</label>
            <InputNumber
              v-model="limitRef"
              :min="0"
              show-buttons
              class="w-full"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Сохранить"
            icon="pi pi-check"
            size="small"
            @click="save"
          />
          <Button
            label="Отмена"
            icon="pi pi-times"
            outlined
            severity="secondary"
            size="small"
            @click="$emit('close')"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
