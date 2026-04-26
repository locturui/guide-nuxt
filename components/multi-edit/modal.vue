<script setup>
const props = defineProps({ pairs: { type: Array, required: true } });
const emit = defineEmits(["close"]);
const s = useScheduleStore();

const limitRef = ref(0);

const sortedPairs = computed(() => {
  return [...props.pairs].sort(([date1, time1], [date2, time2]) => {
    if (date1 !== date2) {
      return date1.localeCompare(date2);
    }
    return time1.localeCompare(time2);
  });
});

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const dayName = days[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month} (${dayName})`;
}

onMounted(() => {
  document.body.style.overflow = "hidden";
});

onUnmounted(() => {
  document.body.style.overflow = "";
});

const backdropMousedown = ref(false);

async function save() {
  await s.bulkSetTimeslotLimits(limitRef.value, props.pairs);
  emit("close");
}
</script>

<template>
  <div
    class="fixed inset-0 bg-black/50 z-[600] flex items-center justify-center p-4"
    @mousedown="backdropMousedown = ($event.target === $event.currentTarget)"
    @click.self="backdropMousedown && $emit('close')"
  >
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
        <div class="flex flex-col gap-4">
          <div class="flex-shrink-0">
            <div class="text-sm text-surface-600 mb-2">
              Выбрано слотов: <strong class="text-surface-900">{{ sortedPairs.length }}</strong>
            </div>
          </div>

          <div class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div class="text-xs font-medium text-surface-500 uppercase mb-2 px-1">
              Список слотов
            </div>
            <div class="flex-1 overflow-y-auto border border-surface-200 rounded-lg bg-surface-50 p-2 max-h-64">
              <div class="space-y-1">
                <div
                  v-for="([d, t], i) in sortedPairs"
                  :key="d + t + i"
                  class="flex items-center gap-2 px-3 py-2 bg-white rounded border border-surface-200 hover:border-surface-300 hover:shadow-sm transition-all"
                >
                  <div class="flex-1">
                    <div class="text-sm font-medium text-surface-900">
                      {{ formatDate(d) }}
                    </div>
                    <div class="text-xs text-surface-600">
                      {{ t }}
                    </div>
                  </div>
                  <Tag
                    :value="`${d} ${t}`"
                    severity="secondary"
                    size="small"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="flex-shrink-0 border-t pt-4">
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
