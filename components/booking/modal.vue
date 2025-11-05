<script setup lang="ts">
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

import { useGuestListsStore } from "@/stores/guest-lists";
import { useScheduleStore } from "@/stores/schedule";
import { isHalfHour, roundToHalfHour } from "~/utils/time";

const props = defineProps<{
  role: "admin" | "agency";
  booking?: { id: number; date: string; time: string; guests: number; agentId?: string | number } | null;
  initialDate?: string;
  initialTime?: string;
}>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "update", data: { date: string; time: string; guests: number }): void;
}>();

const router = useRouter();

const s = useScheduleStore();
const gl = useGuestListsStore();

const editing = computed(() => !!props.booking);
const pending = ref(false);
const hasGuestList = computed(() => props.booking?.id ? gl.hasGuestList(props.booking.id) : false);

const isAssigned = computed(() => {
  if (!props.booking?.id)
    return false;
  const booking = s.allBookings.find(b => b.id === props.booking?.id);
  return booking?.status === "assigned";
});

onMounted(() => {
  document.body.style.overflow = "hidden";
});

onUnmounted(() => {
  document.body.style.overflow = "";
});

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
  if (!v)
    return;
  if (!isHalfHour(v))
    formTime.value = roundToHalfHour(v);
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

const showGuestWarning = computed(() => {
  return props.role === "agency" && formGuests.value > maxLeft.value;
});

async function onSave() {
  if (pending.value)
    return;
  if (!formDate.value || !formTime.value || formGuests.value < 1)
    return;
  if (formGuests.value > maxLeft.value)
    return;

  pending.value = true;
  try {
    if (!editing.value) {
      await s.book(formDate.value, formTime.value, formGuests.value);
      emit("close");
    }
    else if (props.role === "admin") {
      await s.adminModifyBooking({
        bookingId: String(props.booking!.id),
        date: formDate.value,
        time: formTime.value,
        people: formGuests.value,
      });
      await s.fetchWeek();
      emit("update", {
        date: formDate.value,
        time: formTime.value,
        guests: formGuests.value,
      });
    }
    else {
      await s.modifyBooking(String(props.booking!.id), formGuests.value);
      await s.fetchWeek();
      emit("update", {
        date: formDate.value,
        time: formTime.value,
        guests: formGuests.value,
      });
    }
  }
  finally {
    pending.value = false;
  }
}

async function onDelete() {
  if (pending.value)
    return;
  if (!editing.value)
    return;

  pending.value = true;
  try {
    if (props.role === "admin")
      await s.adminCancelBooking(String(props.booking!.id));
    else await s.cancelBooking(String(props.booking!.id));
    emit("close");
  }
  finally {
    pending.value = false;
  }
}

function onEditBooking() {
  if (props.booking?.id) {
    router.push(`/booking/${props.booking.id}/edit`);
    emit("close");
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4" @click="$emit('close')">
    <div
      class="bg-white p-4 sm:p-6 rounded-lg relative w-full max-w-sm"
      @click.stop
    >
      <button
        class="absolute top-2 right-2 btn btn-sm btn-circle btn-ghost"
        @click="$emit('close')"
      >
        ✕
      </button>
      <h3 class="font-bold mb-2">
        {{ editing ? 'Бронирование' : 'Новое бронирование' }}
      </h3>

      <template v-if="!editing">
        <label class="block">Дата</label>
        <Datepicker
          v-model="formDate"
          locale="ru"
          model-type="yyyy-MM-dd"
          :auto-apply="true"
          :teleport="true"
          :ui="{ input: 'input mb-1' }"
          :disabled="pending"
          :enable-time-picker="false"
          :close-on-auto-apply="true"
        />

        <label class="block">Время</label>
        <Datepicker
          v-model="formTime"
          locale="ru"
          time-picker
          is-24
          model-type="HH:mm"
          :minutes-increment="30"
          :minutes-grid-increment="30"
          :min-time="{ hours: 9, minutes: 0 }"
          :max-time="{ hours: 19, minutes: 30 }"
          :auto-apply="true"
          :teleport="true"
          :ui="{ input: 'input mb-1' }"
          :disabled="pending"
          :close-on-auto-apply="true"
        />

        <label class="block">Количество гостей (макс. {{ maxLeft }})</label>
        <input
          v-model.number="formGuests"
          type="number"
          min="1"
          :max="maxLeft"
          class="input mb-1"
          :disabled="pending"
        >
        <div v-if="showGuestWarning" class="text-red-600 text-sm mb-2">
          ⚠️ Количество гостей превышает максимально доступное для данного слота
        </div>
      </template>

      <template v-else>
        <div class="space-y-4">
          <div class="p-4 bg-gray-50 rounded-lg">
            <h4 class="font-semibold mb-2">
              Информация о бронировании
            </h4>
            <div class="space-y-2 text-sm">
              <div><strong>ID:</strong> {{ props.booking?.id }}</div>
              <div><strong>Дата:</strong> {{ props.booking?.date }}</div>
              <div><strong>Время:</strong> {{ props.booking?.time }}</div>
              <div><strong>Гостей:</strong> {{ props.booking?.guests }}</div>
            </div>
          </div>

          <div v-if="role === 'agency' && hasGuestList" class="p-4 bg-green-50 rounded-lg">
            <div class="text-green-800 text-sm">
              ✓ Список гостей загружен
            </div>
          </div>

          <div v-if="role === 'agency' && isAssigned" class="p-4 bg-blue-50 rounded-lg">
            <div class="text-blue-800 text-sm">
              ✓ Гид назначен
            </div>
          </div>
        </div>
      </template>

      <div class="flex justify-end space-x-2 mt-4">
        <button
          v-if="editing"
          class="btn btn-sm btn-error"
          :disabled="pending"
          :class="{ 'btn-disabled': pending }"
          @click="onDelete"
        >
          <span v-if="pending" class="loading loading-dots loading-sm" />
          <span v-else>Удалить</span>
        </button>
        <button
          v-if="editing"
          class="btn btn-sm btn-primary"
          :disabled="pending"
          @click="onEditBooking"
        >
          Редактировать
        </button>
        <button
          v-if="!editing"
          class="btn btn-sm btn-primary"
          :disabled="pending"
          :class="{ 'btn-disabled': pending }"
          @click="onSave"
        >
          <span v-if="pending" class="loading loading-dots loading-sm" />
          <span v-else>Создать</span>
        </button>
      </div>
    </div>
  </div>
</template>
