<script setup lang="ts">
import { useScheduleStore } from "@/stores/schedule";
import { isHalfHour, roundToHalfHour } from "~/utils/time";

const props = defineProps<{
  role: "admin" | "agency";
  booking?: { id: number; date: string; time: string; guests: number } | null;
  initialDate?: string;
  initialTime?: string;
}>();
const emit = defineEmits<{ (e: "close"): void }>();

const s = useScheduleStore();

const editing = computed(() => !!props.booking);

const formDate = ref<string>(props.booking?.date ?? props.initialDate ?? "");
const formTime = ref<string>(props.booking?.time ?? props.initialTime ?? "");
const formGuests = ref<number>(props.booking?.guests ?? 1);

watch([formDate, formTime], async ([d, t]) => {
  if (props.role !== "admin")
    return;
  if (!d || !t)
    return;
  await s.fetchSlotData(d, t);
});

watch(formTime, (v) => {
  if (!v) {
    return;
  }
  if (!isHalfHour(v)) {
    formTime.value = roundToHalfHour(v);
  }
});

const baseLeft = computed(() =>
  formDate.value && formTime.value ? s.remainingCapacity(formDate.value, formTime.value) : 0,
);

const maxLeft = computed(() => {
  if (!editing.value)
    return baseLeft.value;
  const same
    = props.booking && props.booking.date === formDate.value && props.booking.time === formTime.value;
  return same ? baseLeft.value + (props.booking?.guests || 0) : baseLeft.value;
});

async function onSave() {
  if (!formDate.value || !formTime.value || formGuests.value < 1)
    return;
  if (formGuests.value > maxLeft.value)
    return;

  if (!editing.value) {
    await s.book(formDate.value, formTime.value, formGuests.value);
  }
  else if (props.role === "admin") {
    await s.adminModifyBooking({
      bookingId: props.booking!.id,
      date: formDate.value,
      time: formTime.value,
      people: formGuests.value,
    });
  }
  else {
    await s.modifyBooking(props.booking!.id, formGuests.value);
  }
  emit("close");
}

async function onDelete() {
  if (!editing.value)
    return;
  if (props.role === "admin")
    await s.adminCancelBooking(props.booking!.id);
  else await s.cancelBooking(props.booking!.id);
  emit("close");
}
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center z-60">
    <div class="bg-white p-6 rounded-lg w-80">
      <h3 class="font-bold mb-2">
        {{ editing ? 'Изменить бронирование' : 'Новое бронирование' }}
      </h3>

      <label>Дата</label>
      <input
        v-model="formDate"
        type="date"
        lang="ru"
        class="input mb-1"
        :disabled="editing && role !== 'admin' || !editing"
      >

      <label>Время</label>
      <input
        v-model="formTime"
        type="time"
        lang="ru"
        class="input mb-1"
        step="1800"
        :disabled="editing && role !== 'admin' || !editing"
      >

      <label>Количество гостей (макс. {{ maxLeft }})</label>
      <input
        v-model.number="formGuests"
        type="number"
        min="1"
        :max="maxLeft"
        class="input mb-1"
      >

      <div class="flex justify-end space-x-2 mt-4">
        <button
          v-if="editing"
          class="btn btn-sm btn-error"
          @click="onDelete"
        >
          Удалить
        </button>
        <button class="btn btn-sm btn-primary" @click="onSave">
          Сохранить
        </button>
        <button class="btn btn-sm" @click="$emit('close')">
          Отменить
        </button>
      </div>
    </div>
  </div>
</template>
