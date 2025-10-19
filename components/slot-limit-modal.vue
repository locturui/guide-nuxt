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
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-60" @click="$emit('close')">
    <div class="bg-white p-6 rounded-lg w-80 relative" @click.stop>
      <button
        class="absolute top-2 right-2 btn btn-sm btn-circle btn-ghost"
        @click="$emit('close')"
      >
        ✕
      </button>
      <h3 class="font-bold mb-2">
        Задать лимит гостей для слота
      </h3>

      <label class="block">Дата</label>
      <Datepicker
        v-model="formDate"
        locale="ru"
        model-type="yyyy-MM-dd"
        :enable-time-picker="false"
        :auto-apply="true"
        :teleport="true"
        :ui="{ input: 'input' }"
        :disabled="true"
        :close-on-auto-apply="true"
      />

      <label class="block mt-2">Время</label>
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
        :ui="{ input: 'input' }"
        :disabled="true"
        :close-on-auto-apply="true"
      />

      <label class="block mt-2">Лимит гостей</label>
      <input
        v-model.number="limitRef"
        type="number"
        class="input"
        :disabled="pending"
      >

      <div class="flex justify-end space-x-2 mt-4">
        <button
          class="btn btn-sm btn-primary"
          :disabled="pending"
          :class="{ 'btn-disabled': pending }"
          @click="save"
        >
          <span v-if="pending" class="loading loading-dots loading-sm" />
          <span v-else>Сохранить</span>
        </button>
        <button
          class="btn btn-sm"
          :disabled="pending"
          :class="{ 'btn-disabled': pending }"
          @click="$emit('close')"
        >
          Отмена
        </button>
      </div>
    </div>
  </div>
</template>
