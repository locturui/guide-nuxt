<script setup>
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

import { formatRangeTitle, startOfWeek } from "@/utils/date";

const props = defineProps({ weekStart: { type: Date, required: true } });
const emit = defineEmits(["jump", "prev", "next"]);

const show = ref(false);
const jump = ref(null);

onMounted(() => {
  const element = document.querySelector("[data-week-header]");
  if (element) {
    element.addEventListener("close-datepicker", () => {
      show.value = false;
    });
  }
});

const rangeTitle = computed(() => formatRangeTitle(props.weekStart));

function jumpTo() {
  if (!jump.value)
    return;
  const d = startOfWeek(new Date(jump.value));
  emit("jump", d);
  show.value = false;
}
</script>

<template>
  <div class="flex justify-between mb-10" data-week-header>
    <button class="btn btn-sm" @click="$emit('prev')">
      Предыдущая
    </button>

    <div class="relative">
      <h2
        class="font-bold cursor-pointer px-2 py-1 rounded-md shadow-[2px_2px_6px_#00000025] hover:shadow-[3px_3px_8px_#00000035] transition-shadow bg-white"
        @click="show = true"
      >
        {{ rangeTitle }}
      </h2>

      <div
        v-if="show"
        class="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-base-200 p-4 rounded shadow z-50 w-50"
      >
        <Datepicker
          v-model="jump"
          locale="ru"
          :calendar-only="true"
          calendar-class="bg-white rounded shadow-lg p-2"
          input-class="hidden"
          format="dd.MM.yyyy"
          :auto-apply="true"
          :close-on-auto-apply="true"
        />
        <div class="flex justify-end mt-2 gap-2">
          <button class="btn btn-sm btn-primary" @click="jumpTo">
            Перейти
          </button>
          <button class="btn btn-sm" @click="show = false">
            Отмена
          </button>
        </div>
      </div>
    </div>

    <button class="btn btn-sm" @click="$emit('next')">
      Следующая
    </button>
  </div>
</template>
