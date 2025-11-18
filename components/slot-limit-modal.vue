<script setup lang="ts">
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

import { useScheduleStore } from "@/stores/schedule";
import { isHalfHour, roundToHalfHour } from "~/utils/time";

const props = defineProps<{ date: string; time: string; initialLimit?: number }>();
const emit = defineEmits(["close"]);

const s = useScheduleStore();

const formDate = ref<string>(props.date);
const formTime = ref<string>(props.time);
const limitRef = ref<number>(props.initialLimit ?? 0);
const pending = ref(false);

onMounted(() => {
  document.body.style.overflow = "hidden";
});

onUnmounted(() => {
  document.body.style.overflow = "";
});

watch(formTime, (v) => {
  if (!v)
    return;
  if (!isHalfHour(v))
    formTime.value = roundToHalfHour(v);
});

async function save() {
  if (pending.value)
    return;
  pending.value = true;
  try {
    await s.setTimeslotLimit(formDate.value, formTime.value, limitRef.value);
    emit("close");
  }
  finally {
    pending.value = false;
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4" @click="$emit('close')">
    <Card
      class="w-full max-w-sm"
      @click.stop
    >
      <template #header>
        <div class="flex items-center justify-between p-4 pb-2">
          <h3 class="text-lg font-semibold m-0">
            Задать лимит гостей для слота
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
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-surface-700">Дата</label>
            <Datepicker
              v-model="formDate"
              locale="ru"
              model-type="yyyy-MM-dd"
              :enable-time-picker="false"
              :auto-apply="true"
              :teleport="true"
              :ui="{ input: 'p-inputtext w-full' }"
              :disabled="true"
              :close-on-auto-apply="true"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-surface-700">Время</label>
            <Datepicker
              v-model="formTime"
              locale="ru"
              time-picker
              is-24
              model-type="HH:mm"
              :minutes-increment="30"
              :minutes-grid-increment="30"
              :auto-apply="true"
              :teleport="true"
              :ui="{ input: 'p-inputtext w-full' }"
              :disabled="true"
              :close-on-auto-apply="true"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-surface-700">Лимит гостей</label>
            <InputNumber
              v-model="limitRef"
              :min="0"
              :disabled="pending"
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
            :loading="pending"
            :disabled="pending"
            @click="save"
          />
          <Button
            label="Отмена"
            icon="pi pi-times"
            outlined
            severity="secondary"
            size="small"
            :disabled="pending"
            @click="$emit('close')"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
